import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireAuthSession: vi.fn(), updatePreferredCurrency: vi.fn() }))
vi.mock('@@/server/services/session', () => ({ requireAuthSession: mocks.requireAuthSession }))
vi.mock('@@/server/repositories/profile', () => ({ updatePreferredCurrency: mocks.updatePreferredCurrency }))
let body: unknown

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readValidatedBody', (_event: unknown, validate: (input: unknown) => unknown) => validate(body))
  vi.stubGlobal('createError', (error: unknown) => error)
  mocks.requireAuthSession.mockResolvedValue({ user: { id: 'owner' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('account currency endpoint', () => {
  it('requires sign-in before making any change', async () => {
    mocks.requireAuthSession.mockRejectedValue({ statusCode: 401 })
    const { default: handler } = await import('@@/server/api/profile/currency.patch')
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.updatePreferredCurrency).not.toHaveBeenCalled()
  })
  it.each(['NGN', 'USD'])('updates only the authenticated user to %s', async (preferredCurrency) => {
    body = { preferredCurrency }
    mocks.updatePreferredCurrency.mockResolvedValue(body)
    const { default: handler } = await import('@@/server/api/profile/currency.patch')
    await expect(handler({} as never)).resolves.toEqual(body)
    expect(mocks.updatePreferredCurrency).toHaveBeenCalledWith('owner', preferredCurrency)
  })
  it.each([{}, { preferredCurrency: 'EUR' }, { preferredCurrency: null }, { preferredCurrency: 'NGN', userId: 'another-user' }])('rejects invalid or extra fields: %j', async (invalid) => {
    body = invalid
    const { default: handler } = await import('@@/server/api/profile/currency.patch')
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.updatePreferredCurrency).not.toHaveBeenCalled()
  })
})
