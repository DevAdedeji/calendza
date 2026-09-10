import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getConnectedAccountBalance, listConnectedAccountPayouts } from '@@/server/integrations/bachs'
import { collectedPaymentTotals } from '@@/server/repositories/payment-ledger'
import { findPaymentRecipient } from '@@/server/services/payment-recipient'
import { paymentSummary } from '@@/server/services/payment-summary'

vi.mock('@@/server/integrations/bachs', () => ({
  getConnectedAccountBalance: vi.fn(),
  listConnectedAccountPayouts: vi.fn()
}))
vi.mock('@@/server/repositories/payment-ledger', () => ({ collectedPaymentTotals: vi.fn() }))
vi.mock('@@/server/services/payment-recipient', () => ({ findPaymentRecipient: vi.fn() }))
vi.mock('@@/server/observability/logger', () => ({ logEvent: vi.fn() }))

describe('payment summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('never combines unlike currencies and only counts completed payouts', async () => {
    vi.mocked(findPaymentRecipient).mockResolvedValue({ id: 'recipient-1', bachsAccountId: 'acct_1' } as never)
    vi.mocked(collectedPaymentTotals).mockResolvedValue([{ currency: 'USD', amountCents: 500 }])
    vi.mocked(getConnectedAccountBalance).mockResolvedValue({
      account_id: 'acct_1',
      total_balance_usd: '5.00',
      balances: [
        { currency: 'USD', available_balance: '4.20', pending_balance: '0.55' },
        { currency: 'NGN', available_balance: '1000.00', pending_balance: '50.00' }
      ]
    })
    vi.mocked(listConnectedAccountPayouts).mockResolvedValue([
      { id: 'paid', status: 'completed', amount: '250.00', currency: 'NGN' },
      { id: 'pending', status: 'processing', amount: '100.00', currency: 'NGN' }
    ])

    await expect(paymentSummary({ userId: 'user-1' })).resolves.toMatchObject({
      collected: [{ currency: 'USD', amountCents: 500 }],
      available: [
        { currency: 'NGN', amountCents: 100_000 },
        { currency: 'USD', amountCents: 420 }
      ],
      pending: [
        { currency: 'NGN', amountCents: 5_000 },
        { currency: 'USD', amountCents: 55 }
      ],
      withdrawn: [{ currency: 'NGN', amountCents: 25_000 }],
      providerStatus: 'available'
    })
  })

  it('keeps collected totals visible when Bachs is temporarily unavailable', async () => {
    vi.mocked(findPaymentRecipient).mockResolvedValue({ id: 'recipient-1', bachsAccountId: 'acct_1' } as never)
    vi.mocked(collectedPaymentTotals).mockResolvedValue([{ currency: 'USD', amountCents: 500 }])
    vi.mocked(getConnectedAccountBalance).mockRejectedValue(new Error('timeout'))
    vi.mocked(listConnectedAccountPayouts).mockResolvedValue([])

    await expect(paymentSummary({ userId: 'user-1' })).resolves.toMatchObject({
      collected: [{ currency: 'USD', amountCents: 500 }],
      available: [],
      withdrawn: [],
      providerStatus: 'unavailable'
    })
  })
})
