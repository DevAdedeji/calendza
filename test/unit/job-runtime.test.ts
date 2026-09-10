import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRuntimeTasks } from '@@/server/services/job-runtime'
import { dispatchDomainEvents, processAutomationRuns } from '@@/server/services/workflows'
import { expireLapsedTeams, processBillingReminders } from '@@/server/services/billing-reminders'
import { pruneWorkerInstances } from '@@/server/services/worker-coordination'

vi.mock('@@/server/services/workflows', () => ({
  dispatchDomainEvents: vi.fn(),
  processAutomationRuns: vi.fn()
}))
vi.mock('@@/server/services/billing-reminders', () => ({
  expireLapsedTeams: vi.fn(),
  processBillingReminders: vi.fn()
}))
vi.mock('@@/server/services/worker-coordination', () => ({
  pruneWorkerInstances: vi.fn()
}))

describe('runtime task result adapters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('counts dispatched events and delivered automation runs', async () => {
    vi.mocked(dispatchDomainEvents).mockResolvedValue(2)
    vi.mocked(processAutomationRuns).mockResolvedValue(3)
    const task = defaultRuntimeTasks().find(task => task.name === 'workflow-automation')!

    await expect(task.run()).resolves.toBe(5)
    expect(dispatchDomainEvents).toHaveBeenCalledBefore(processAutomationRuns)
  })

  it('leaves an idle automation pass at zero', async () => {
    vi.mocked(dispatchDomainEvents).mockResolvedValue(0)
    vi.mocked(processAutomationRuns).mockResolvedValue(0)

    await expect(defaultRuntimeTasks().find(task => task.name === 'workflow-automation')!.run()).resolves.toBe(0)
  })

  it('propagates dispatch failure without starting delivery', async () => {
    const failure = new Error('Database unavailable')
    vi.mocked(dispatchDomainEvents).mockRejectedValue(failure)

    await expect(defaultRuntimeTasks().find(task => task.name === 'workflow-automation')!.run()).rejects.toBe(failure)
    expect(processAutomationRuns).not.toHaveBeenCalled()
  })

  it('counts sent billing reminders and expired teams, not merely inspected teams', async () => {
    vi.mocked(processBillingReminders).mockResolvedValue({ sent: 2, teams: 10 })
    vi.mocked(expireLapsedTeams).mockResolvedValue(3)

    await expect(defaultRuntimeTasks().find(task => task.name === 'billing-maintenance')!.run()).resolves.toBe(5)
    expect(processBillingReminders).toHaveBeenCalledBefore(expireLapsedTeams)
    expect(expireLapsedTeams).toHaveBeenCalledBefore(pruneWorkerInstances)
  })

  it('still counts expired teams when billing reminders are not configured', async () => {
    vi.mocked(processBillingReminders).mockResolvedValue({ sent: 0, skipped: 'billing-not-configured' })
    vi.mocked(expireLapsedTeams).mockResolvedValue(3)

    await expect(defaultRuntimeTasks().find(task => task.name === 'billing-maintenance')!.run()).resolves.toBe(3)
    expect(pruneWorkerInstances).toHaveBeenCalledOnce()
  })

  it('propagates maintenance failure without claiming a completed count', async () => {
    vi.mocked(processBillingReminders).mockResolvedValue({ sent: 2, teams: 2 })
    const failure = new Error('Expiry failed')
    vi.mocked(expireLapsedTeams).mockRejectedValue(failure)

    await expect(defaultRuntimeTasks().find(task => task.name === 'billing-maintenance')!.run()).rejects.toBe(failure)
    expect(pruneWorkerInstances).not.toHaveBeenCalled()
  })
})
