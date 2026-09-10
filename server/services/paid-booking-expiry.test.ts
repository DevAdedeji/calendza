import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCheckoutSession } from '@@/server/integrations/bachs'
import { useDatabase } from '@@/server/database'
import { expirePaidBookingHolds } from '@@/server/services/paid-booking'

vi.mock('@@/server/database', () => ({ useDatabase: vi.fn() }))
vi.mock('@@/server/integrations/bachs', () => ({
  createCheckoutSession: vi.fn(),
  createRefund: vi.fn(),
  getCheckoutSession: vi.fn()
}))

describe('paid booking hold expiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps an expired local hold while Bachs still reports payment processing', async () => {
    const where = vi.fn().mockResolvedValue([{ id: 'payment-1', checkoutId: 'chk_processing' }])
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where }))
      }))
    }
    vi.mocked(useDatabase).mockReturnValue(database as never)
    vi.mocked(getCheckoutSession).mockResolvedValue({
      checkout_id: 'chk_processing',
      status: 'open',
      payment_status: 'processing',
      amount: '1.00',
      currency: 'USD',
      reference: 'booking-1'
    })

    await expect(expirePaidBookingHolds()).resolves.toBe(0)
    expect(getCheckoutSession).toHaveBeenCalledWith('chk_processing')
  })
})
