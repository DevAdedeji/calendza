import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ quote: vi.fn(), key: 'sk_sandbox_test', log: vi.fn() }))
vi.mock('@@/server/integrations/bachs', () => ({ quoteConversion: mocks.quote }))
vi.mock('@@/server/config/env', () => ({ useEnv: () => ({ bachsSecretKey: mocks.key }) }))
vi.mock('@@/server/observability/logger', () => ({ logEvent: mocks.log }))
let getRates: typeof import('@@/server/services/payment-display-rates').paymentDisplayRates
const now = new Date('2026-09-20T12:00:00Z')
const funds: 'USD'[] = ['USD']
const quote = () => ({ from_currency: 'USD', to_currency: 'NGN', from_amount: '100.00', to_amount: '150025.00', exchange_rate: '1500.25', expires_at: new Date(Date.now() + 45_000).toISOString() })

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  mocks.key = 'sk_sandbox_test'
  mocks.quote.mockImplementation(async () => quote())
  getRates = (await import('@@/server/services/payment-display-rates')).paymentDisplayRates
})
afterEach(() => vi.useRealTimers())

describe('Bachs display exchange rates', () => {
  it('requests only a quote, validates it and coalesces simultaneous requests', async () => {
    const [first, second] = await Promise.all([getRates(funds), getRates(funds)])
    expect(first).toEqual(second)
    expect(first).toEqual([{ from: 'USD', to: 'NGN', rate: '1500.25', quotedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 300_000).toISOString() }])
    expect(mocks.quote).toHaveBeenCalledExactlyOnceWith('USD', 'NGN', '100.00')
    await getRates(funds)
    expect(mocks.quote).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300_000)
    await getRates(funds)
    expect(mocks.quote).toHaveBeenCalledTimes(2)
  })
  it('keeps sandbox and live quote caches separate', async () => {
    await getRates(funds)
    mocks.key = 'sk_live_test'
    await getRates(funds)
    expect(mocks.quote).toHaveBeenCalledTimes(2)
  })
  it('makes no provider requests for no requested currencies or unconfigured payments', async () => {
    expect(await getRates([])).toEqual([])
    mocks.key = ''
    expect(await getRates(funds)).toEqual([])
    expect(mocks.quote).not.toHaveBeenCalled()
  })
  it('requests each direction separately for mixed balances', async () => {
    mocks.quote.mockImplementation(async (from, to, amount) => from === 'USD' ? quote() : ({ ...quote(), from_currency: from, to_currency: to, from_amount: amount, to_amount: '3.60', exchange_rate: '1388.2248' }))
    expect(await getRates([...funds, 'NGN'])).toHaveLength(2)
    expect(mocks.quote).toHaveBeenCalledWith('NGN', 'USD', '5000.00')
    const reverse = (await getRates(['NGN']))[0]
    expect(reverse).toMatchObject({ inverse: true, rate: '1388.2248' })
  })
  it.each([
    { exchange_rate: '0' }, { exchange_rate: '-1' }, { exchange_rate: '1e3' },
    { exchange_rate: null }, { from_currency: 'NGN' }, { to_currency: 'USD' },
    { from_amount: '1.00' }, { to_amount: '9000000.00' }, { expires_at: now.toISOString() }, { expires_at: 'invalid' }
  ])('does not display an invalid or expired quote: %j', async (invalid) => {
    mocks.quote.mockResolvedValue({ ...quote(), ...invalid })
    expect(await getRates(funds)).toEqual([])
    expect(mocks.log).toHaveBeenCalledWith('warn', 'payment_display_rate_unavailable', { from: 'USD', to: 'NGN' })
  })
  it('does not reuse expired rates after a failure, then recovers after a short cooldown', async () => {
    await getRates(funds)
    vi.advanceTimersByTime(300_000)
    mocks.quote.mockRejectedValue(new Error('timeout'))
    expect(await getRates(funds)).toEqual([])
    expect(await getRates(funds)).toEqual([])
    expect(mocks.quote).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10_000)
    mocks.quote.mockImplementation(async () => quote())
    expect(await getRates(funds)).toHaveLength(1)
  })
})
