export const IDLE_JOB_RECHECK_MS = 60 * 60_000

/** Timers only wake the worker; persisted jobs, deadlines and leases own the work. */
export function startJobSchedule(options: {
  intervalMs: number
  initialDelayMs?: number
  run: () => Promise<unknown>
  nextRunAt?: () => Promise<Date | null>
  onError: (error: unknown) => void
}) {
  let stopped = false
  let running = false
  let wakeRequested = false
  let lastStartedAt = -Infinity
  let scheduledAt = Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined

  function schedule(at: number) {
    if (stopped || at >= scheduledAt) return
    clearTimeout(timer)
    scheduledAt = at
    timer = setTimeout(() => {
      inFlight = run().finally(() => {
        inFlight = undefined
      })
    }, Math.max(0, at - Date.now()))
    timer.unref()
  }

  function wake() {
    if (stopped || !options.nextRunAt) return
    if (running) wakeRequested = true
    else schedule(Math.max(Date.now(), lastStartedAt + options.intervalMs))
  }

  async function run() {
    scheduledAt = Infinity
    if (stopped || running) return
    running = true
    lastStartedAt = Date.now()
    let nextAt = Date.now() + options.intervalMs
    try {
      await options.run()
      if (stopped) return
      if (options.nextRunAt) {
        const due = await options.nextRunAt()
        if (due && !Number.isFinite(due.getTime())) throw new Error('Invalid job deadline')
        const safetyCheck = (Math.floor(Date.now() / IDLE_JOB_RECHECK_MS) + 1) * IDLE_JOB_RECHECK_MS
        nextAt = Math.min(safetyCheck, due?.getTime() ?? Infinity)
      } else {
        // Housekeeping and heartbeat share a wake-up rather than keeping the DB awake in shifts.
        nextAt = (Math.floor(Date.now() / options.intervalMs) + 1) * options.intervalMs
      }
    } catch (error) {
      options.onError(error)
    } finally {
      running = false
      if (wakeRequested) nextAt = Date.now()
      wakeRequested = false
      schedule(options.nextRunAt ? Math.max(nextAt, lastStartedAt + options.intervalMs) : nextAt)
    }
  }

  schedule(Date.now() + (options.initialDelayMs ?? 0))
  return {
    wake,
    cancel() {
      stopped = true
      clearTimeout(timer)
      return inFlight ?? Promise.resolve()
    }
  }
}
