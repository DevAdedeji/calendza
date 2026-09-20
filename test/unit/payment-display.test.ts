import { describe, expect, it } from 'vitest'
import { displayMoneyTotal, type DisplayExchangeRate } from '#shared/payment-display'

const now = Date.parse('2026-09-20T12:00:00Z')
const rates: DisplayExchangeRate[] = [
  { from: 'USD', to: 'NGN', rate: '1500.25', quotedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString() },
  { from: 'NGN', to: 'USD', rate: '0.00065', quotedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString() }
]

describe('display-only currency conversion', () => {
  it('shows the same $9.50 balance in naira without changing the source', () => {
    const funds = [{ currency: 'USD' as const, amountCents: 950 }]
    expect(displayMoneyTotal(funds, 'NGN', rates, now)).toEqual({ amountCents: 1425238, estimated: true })
    expect(displayMoneyTotal(funds, 'USD', rates, now)).toEqual({ amountCents: 950, estimated: false })
    expect(funds).toEqual([{ currency: 'USD', amountCents: 950 }])
  })
  it('combines actual funds in both currencies, including negative balances', () => {
    expect(displayMoneyTotal([{ currency: 'USD', amountCents: 950 }, { currency: 'NGN', amountCents: -10000 }], 'NGN', rates, now))
      .toEqual({ amountCents: 1415238, estimated: true })
  })
  it('uses the provider’s directional rate instead of inventing an inverse rate', () => {
    expect(displayMoneyTotal([{ currency: 'NGN', amountCents: 150000 }], 'USD', rates, now))
      .toEqual({ amountCents: 98, estimated: true })
  })
  it('rounds signed half-cents symmetrically using decimal arithmetic', () => {
    for (const sign of [1, -1]) {
      expect(displayMoneyTotal([{ currency: 'USD', amountCents: sign * 2 }], 'NGN', rates, now).amountCents).toBe(sign * 3001)
    }
  })
  it('divides by the Bachs NGN-per-USD rate for reverse quotes', () => {
    expect(displayMoneyTotal([{ currency: 'NGN', amountCents: 500000 }], 'USD', [{ ...rates[1]!, rate: '1388.2248', inverse: true }], now))
      .toEqual({ amountCents: 360, estimated: true })
  })
  it('never substitutes a partial native total when conversion is unavailable', () => {
    const funds = [{ currency: 'NGN' as const, amountCents: 100 }, { currency: 'USD' as const, amountCents: 950 }]
    expect(displayMoneyTotal(funds, 'NGN', [], now).amountCents).toBeNull()
    expect(displayMoneyTotal(funds, 'NGN', rates, now + 60_000).amountCents).toBeNull()
  })
  it('does not need an exchange rate for empty or native-only totals', () => {
    expect(displayMoneyTotal([{ currency: 'USD', amountCents: 0 }], 'NGN', [], now)).toEqual({ amountCents: 0, estimated: false })
    expect(displayMoneyTotal([{ currency: 'NGN', amountCents: 100 }], 'NGN', [], now)).toEqual({ amountCents: 100, estimated: false })
  })
  it.each(['0', '-1', 'NaN', '1e3', '1.2.3'])('rejects invalid rates: %s', (rate) => {
    expect(displayMoneyTotal([{ currency: 'USD', amountCents: 950 }], 'NGN', [{ ...rates[0]!, rate }], now).amountCents).toBeNull()
  })
  it('fails safely on unsafe monetary integers and overflow', () => {
    expect(displayMoneyTotal([{ currency: 'USD', amountCents: 0.1 }], 'USD', [], now).amountCents).toBeNull()
    expect(displayMoneyTotal([{ currency: 'USD', amountCents: Number.MAX_SAFE_INTEGER }], 'NGN', rates, now).amountCents).toBeNull()
  })
})
