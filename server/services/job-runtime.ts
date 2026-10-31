import { randomUUID } from 'node:crypto'
import { enqueueCalendarReconciliation, processCalendarSyncJobs } from '@@/server/services/calendar-sync'
import { processEmailOutbox } from '@@/server/services/email-outbox'
import { processSubscriptionSeatSyncJobs } from '@@/server/services/subscription-seat-sync'
import { expireLapsedTeams, processBillingReminders } from '@@/server/services/billing-reminders'
import { evaluateOperationsAlerts } from '@@/server/services/operations-alerts'
import { dispatchDomainEvents, processAutomationRuns } from '@@/server/services/workflows'
import { expirePaidBookingHolds, retryStalePaidBookingRefunds } from '@@/server/services/paid-booking'
import {
  heartbeatWorkerInstance,
  pruneWorkerInstances,
  registerWorkerInstance,
  stopWorkerInstance,
  withWorkerLease
} from '@@/server/services/worker-coordination'
import { logEvent } from '@@/server/observability/logger'
import { IDLE_JOB_RECHECK_MS, startJobSchedule } from '@@/server/services/job-schedule'
import { nextAutomationAt, nextCalendarSyncAt, nextEmailAt, nextPaidBookingHoldAt, nextPaidBookingRefundAt, nextSeatSyncAt } from '@@/server/services/job-deadlines'

export interface RuntimeTask {
  name: string
  intervalMs: number
  initialDelayMs?: number
  leaseMs?: number
  run: () => Promise<number>
  nextRunAt?: () => Promise<Date | null>
}

export function defaultRuntimeTasks(): RuntimeTask[] {
  return [
    {
      name: 'calendar-sync',
      nextRunAt: nextCalendarSyncAt,
      intervalMs: 5_000,
      leaseMs: 60_000,
      run: () => processCalendarSyncJobs()
    },
    {
      name: 'calendar-reconciliation',
      intervalMs: IDLE_JOB_RECHECK_MS,
      initialDelayMs: 45_000,
      leaseMs: 60_000,
      run: () => enqueueCalendarReconciliation()
    },
    {
      name: 'email-outbox',
      nextRunAt: nextEmailAt,
      intervalMs: 5_000,
      leaseMs: 60_000,
      run: () => processEmailOutbox()
    },
    {
      name: 'workflow-automation',
      nextRunAt: nextAutomationAt,
      intervalMs: 5_000,
      leaseMs: 60_000,
      run: async () => {
        const dispatched = await dispatchDomainEvents()
        const delivered = await processAutomationRuns()
        return dispatched + delivered
      }
    },
    {
      name: 'paid-booking-holds',
      nextRunAt: nextPaidBookingHoldAt,
      intervalMs: 60_000,
      leaseMs: 60_000,
      run: () => expirePaidBookingHolds()
    },
    {
      name: 'paid-booking-refunds',
      nextRunAt: nextPaidBookingRefundAt,
      intervalMs: 15 * 60_000,
      initialDelayMs: 30_000,
      leaseMs: 120_000,
      run: () => retryStalePaidBookingRefunds()
    },
    {
      name: 'subscription-seat-sync',
      nextRunAt: nextSeatSyncAt,
      intervalMs: 5_000,
      leaseMs: 60_000,
      run: () => processSubscriptionSeatSyncJobs()
    },
    {
      name: 'operations-alerts',
      intervalMs: IDLE_JOB_RECHECK_MS,
      initialDelayMs: 15_000,
      leaseMs: 120_000,
      run: () => evaluateOperationsAlerts()
    },
    {
      name: 'billing-maintenance',
      intervalMs: 60 * 60 * 1000,
      leaseMs: 10 * 60_000,
      run: async () => {
        const reminders = await processBillingReminders()
        const expired = await expireLapsedTeams()
        await pruneWorkerInstances()
        return reminders.sent + expired
      }
    }
  ]
}

export function createJobRuntime(input: {
  role: 'worker' | 'all'
  workerId?: string
  tasks?: RuntimeTask[]
  heartbeatMs?: number
  shutdownTimeoutMs?: number
}) {
  const workerId = input.workerId ?? randomUUID()
  const tasks = input.tasks ?? defaultRuntimeTasks()
  const heartbeatMs = input.heartbeatMs ?? IDLE_JOB_RECHECK_MS
  const shutdownTimeoutMs = input.shutdownTimeoutMs ?? 25_000
  const schedules = new Map<string, ReturnType<typeof startJobSchedule>>()
  const inFlight = new Map<string, Promise<void>>()
  let started = false
  let stopping = false

  const runTask = (task: RuntimeTask) => {
    if (stopping || inFlight.has(task.name)) return inFlight.get(task.name)

    const promise = (async () => {
      const startedAt = performance.now()
      try {
        const execution = await withWorkerLease({
          name: `runtime:${task.name}`,
          ownerId: workerId,
          ttlMs: task.leaseMs,
          task: task.run
        })
        if (!execution.acquired) return

        const count = execution.result
        if (count > 0 || task.name === 'paid-booking-holds') {
          // A worker may commit follow-up emails/events without any HTTP request.
          for (const [name, schedule] of schedules) if (name !== task.name) schedule.wake()
        }
        if (count > 0) {
          logEvent('info', 'worker_task_completed', {
            workerId,
            task: task.name,
            processed: count,
            durationMs: Math.round((performance.now() - startedAt) * 10) / 10
          })
        }
      } catch (error) {
        logEvent('error', 'worker_task_failed', {
          workerId,
          task: task.name,
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
          error
        })
        throw error
      }
    })().finally(() => inFlight.delete(task.name))

    inFlight.set(task.name, promise)
    return promise
  }

  async function start() {
    if (started) return
    started = true
    await registerWorkerInstance(workerId, input.role)

    schedules.set('heartbeat', startJobSchedule({
      intervalMs: heartbeatMs,
      initialDelayMs: (Math.floor(Date.now() / heartbeatMs) + 1) * heartbeatMs - Date.now(),
      run: async () => {
        const alive = await heartbeatWorkerInstance(workerId)
        // Test resets and manual maintenance can remove the row while the
        // process is healthy. Re-register instead of reporting a false outage.
        if (!alive) await registerWorkerInstance(workerId, input.role)
      },
      onError: error => logEvent('error', 'worker_heartbeat_failed', {
        workerId,
        error
      })
    }))

    for (const task of tasks) {
      schedules.set(task.name, startJobSchedule({
        ...task,
        // A dedicated worker cannot receive the web process's local wake signal.
        // Keep its polling contract until a cross-process wake transport exists.
        nextRunAt: input.role === 'all' ? task.nextRunAt : undefined,
        run: () => runTask(task) ?? Promise.resolve(),
        onError: error => logEvent('error', 'worker_schedule_failed', { workerId, task: task.name, error })
      }))
    }

    logEvent('info', 'worker_runtime_started', {
      workerId,
      role: input.role,
      tasks: tasks.map(task => task.name)
    })
  }

  async function stop() {
    if (!started || stopping) return
    stopping = true
    const pendingSchedules = [...schedules.values()].map(schedule => schedule.cancel())
    schedules.clear()

    const draining = Promise.allSettled([...inFlight.values(), ...pendingSchedules])
    let timedOut = false
    let shutdownTimer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      draining,
      new Promise<void>((resolve) => {
        shutdownTimer = setTimeout(() => {
          timedOut = true
          resolve()
        }, shutdownTimeoutMs)
        shutdownTimer.unref()
      })
    ])
    if (shutdownTimer) clearTimeout(shutdownTimer)

    // A timed-out task may still be executing in this process. Keep its lease
    // alive until it finishes (or this process dies and the lease expires) so a
    // replacement worker cannot overlap the same schedule prematurely.
    await stopWorkerInstance(workerId, !timedOut)
    logEvent(timedOut ? 'warn' : 'info', 'worker_runtime_stopped', {
      workerId,
      graceful: !timedOut,
      unfinishedTasks: timedOut ? [...inFlight.keys()] : []
    })
  }

  return {
    workerId,
    start,
    stop,
    runTask,
    wake() {
      for (const schedule of schedules.values()) schedule.wake()
    },
    get runningTasks() { return [...inFlight.keys()] }
  }
}
