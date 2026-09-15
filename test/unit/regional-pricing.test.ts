import { describe, expect, it } from 'vitest'
import { DEFAULT_BILLING_INTERVAL } from '#shared/billing'
import { planPriceCents, decimalAmountCents, formatInvoiceAmount, formatSubscriptionMoney, preferredBillingCurrency } from '#shared/regional-pricing'

describe('regional subscription amounts', () => {
  it('uses fixed NGN amounts with two months off annual billing', () => {
    expect(planPriceCents('personal', 'monthly', 'NGN')).toBe(750000)
    expect(planPriceCents('personal', 'yearly', 'NGN')).toBe(7500000)
    expect(planPriceCents('team', 'monthly', 'NGN')).toBe(1000000)
    expect(planPriceCents('team', 'yearly', 'NGN')).toBe(10000000)
  })

  it('preserves USD prices', () => {
    expect(planPriceCents('personal', 'monthly', 'USD')).toBe(600)
    expect(planPriceCents('personal', 'yearly', 'USD')).toBe(6000)
    expect(planPriceCents('team', 'monthly', 'USD')).toBe(800)
    expect(planPriceCents('team', 'yearly', 'USD')).toBe(8000)
  })

  it('defaults new selections to monthly billing', () => {
    expect(DEFAULT_BILLING_INTERVAL).toBe('monthly')
  })

  it('formats both currencies without changing their value', () => {
    expect(formatSubscriptionMoney(600, 'USD')).toBe('$6')
    expect(formatSubscriptionMoney(930150, 'NGN')).toBe('₦9,301.50')
  })

  it('parses payment decimals without partial matches or rounding extra precision', () => {
    expect(decimalAmountCents('9301.50')).toBe(930150)
    expect(decimalAmountCents('0.01')).toBe(1)
    for (const amount of ['-1', '1.234', '5x', '', '1e2', 'Infinity']) {
      expect(() => decimalAmountCents(amount)).toThrow()
    }
  })

  it('uses Lagos only as the Nigerian default', () => {
    expect(preferredBillingCurrency('Africa/Lagos')).toBe('NGN')
    for (const zone of ['Africa/Accra', 'America/New_York', 'Europe/London', '', 'Africa/Niamey']) {
      expect(preferredBillingCurrency(zone)).toBe('USD')
    }
  })

  it('shows historic NGN collection amounts, never the USD base relabelled as naira', () => {
    expect(formatInvoiceAmount({ amountCents: 600, collectionCurrency: 'NGN', collectionAmount: '9000.00' })).toBe('₦9,000')
    expect(formatInvoiceAmount({ amountCents: 600, collectionCurrency: 'NGN', collectionAmount: null })).toBe('NGN amount unavailable')
    expect(formatInvoiceAmount({ amountCents: 600, collectionCurrency: 'USD', collectionAmount: null })).toBe('$6')
    expect(formatInvoiceAmount({ amountCents: 600, collectionCurrency: 'NGN', collectionAmount: 'NaN' })).toBe('Amount unavailable')
  })
})
