import { afterEach, describe, expect, it, vi } from 'vitest'
import { startJobSchedule } from '@@/server/services/job-schedule'

afterEach(() => vi.useRealTimers())

describe('idle job scheduling', () => {
  const epoch = new Date('2026-10-31T00:00:00Z')

  it('does not poll an empty queue between hourly recovery checks', async () => {
    vi.useFakeTimers({ now: epoch })
    const run = vi.fn().mockResolvedValue(0)
    const nextRunAt = vi.fn().mockResolvedValue(null)
    const schedule = startJobSchedule({ run, nextRunAt, intervalMs: 5_000, onError: vi.fn() })
    await vi.advanceTimersByTimeAsync(3_599_999)
    expect(run).toHaveBeenCalledTimes(1)
    expect(nextRunAt).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    schedule.cancel()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('runs a persisted reminder at its deadline without traffic', async () => {
    vi.useFakeTimers({ now: epoch })
    const run = vi.fn().mockResolvedValue(0)
    const nextRunAt = vi.fn().mockResolvedValueOnce(new Date(+epoch + 7 * 60_000)).mockResolvedValue(null)
    const schedule = startJobSchedule({ run, nextRunAt, intervalMs: 5_000, onError: vi.fn() })
    await vi.advanceTimersByTimeAsync(7 * 60_000 - 1)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    schedule.cancel()
  })

  it('coalesces committed work without losing a wake during a deadline query', async () => {
    vi.useFakeTimers({ now: epoch })
    let finish!: (date: Date | null) => void
    const run = vi.fn().mockResolvedValue(0)
    const nextRunAt = vi.fn().mockImplementationOnce(() => new Promise<Date | null>((resolve) => {
      finish = resolve
    })).mockResolvedValue(null)
    const schedule = startJobSchedule({ run, nextRunAt, intervalMs: 5_000, onError: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 0; i < 100; i++) schedule.wake()
    finish(null)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(60_000)
    schedule.wake()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(3)
    schedule.cancel()
  })

  it('retries failed or invalid deadline reads rather than treating them as empty', async () => {
    vi.useFakeTimers({ now: epoch })
    const error = new Error('database unavailable')
    const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(0)
    const nextRunAt = vi.fn().mockResolvedValueOnce(new Date('invalid')).mockResolvedValue(null)
    const onError = vi.fn()
    const schedule = startJobSchedule({ run, nextRunAt, intervalMs: 5_000, onError })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(2)
    schedule.cancel()
  })

  it('does not overlap slow jobs or reschedule them after shutdown', async () => {
    vi.useFakeTimers({ now: epoch })
    let finish!: () => void
    const run = vi.fn(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const schedule = startJobSchedule({ run, nextRunAt: async () => null, intervalMs: 5_000, onError: vi.fn() })
    await vi.advanceTimersByTimeAsync(10_000)
    schedule.wake()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(1)
    schedule.cancel()
    finish()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aligns periodic housekeeping and ignores queue wake-ups', async () => {
    vi.useFakeTimers({ now: +epoch + 10_000 })
    const run = vi.fn().mockResolvedValue(0)
    const schedule = startJobSchedule({ run, intervalMs: 3_600_000, onError: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    schedule.wake()
    await vi.advanceTimersByTimeAsync(3_590_000)
    expect(run).toHaveBeenCalledTimes(2)
    schedule.cancel()
  })
})
