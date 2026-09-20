import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rates: vi.fn() }))
vi.mock('@@/server/services/session', () => ({ requireAuthSession: mocks.auth }))
vi.mock('@@/server/services/payment-display-rates', () => ({ paymentDisplayRates: mocks.rates }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('setResponseHeader', vi.fn())
  mocks.auth.mockResolvedValue({ user: { id: 'host' } })
  mocks.rates.mockResolvedValue([])
})
afterEach(() => vi.unstubAllGlobals())

it('does not request Bachs quotes for an unsigned visitor', async () => {
  mocks.auth.mockRejectedValue({ statusCode: 401 })
  const { default: handler } = await import('@@/server/api/payment-display-rates.get')
  await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 401 })
  expect(mocks.rates).not.toHaveBeenCalled()
})
it('provides both display directions after authentication without using account funds', async () => {
  const { default: handler } = await import('@@/server/api/payment-display-rates.get')
  await expect(handler({} as never)).resolves.toEqual([])
  expect(mocks.rates).toHaveBeenCalledWith(['USD', 'NGN'])
})
