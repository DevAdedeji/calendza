import { personalProPriceCents, seatPriceCents, type BillingInterval, type CollectionCurrency } from '#shared/billing'

export function planPriceCents(plan: 'personal' | 'team', interval: BillingInterval): number {
  return plan === 'personal' ? personalProPriceCents(interval) : seatPriceCents(interval)
}

export function decimalAmountCents(value: string): number {
  if (!/^(0|[1-9]\d{0,14})(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid payment amount')
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(whole + fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('Payment amount exceeds supported range')
  return cents
}

export function formatSubscriptionMoney(cents: number, currency: CollectionCurrency): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid minor-unit amount')
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency', currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(cents / 100)
}

// A timezone is only a default for account display, not subscription billing.
export function preferredBillingCurrency(timeZone: string): CollectionCurrency {
  return timeZone === 'Africa/Lagos' ? 'NGN' : 'USD'
}

export function formatInvoiceAmount(invoice: {
  amountCents: number
  collectionCurrency: string
  collectionAmount: string | null
}): string {
  if (invoice.collectionCurrency !== 'NGN' && invoice.collectionCurrency !== 'USD') return 'Amount unavailable'
  if (invoice.collectionAmount !== null) {
    try {
      return formatSubscriptionMoney(decimalAmountCents(invoice.collectionAmount), invoice.collectionCurrency)
    } catch {
      return 'Amount unavailable'
    }
  }
  return invoice.collectionCurrency === 'USD'
    ? formatSubscriptionMoney(invoice.amountCents, 'USD')
    : 'NGN amount unavailable'
}
