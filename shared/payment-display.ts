import type { PaymentCurrency } from '#shared/payments'

export interface DisplayExchangeRate {
  from: PaymentCurrency
  to: PaymentCurrency
  rate: string
  inverse?: boolean
  quotedAt: string
  expiresAt: string
}

export interface DisplayMoneyTotal {
  currency: PaymentCurrency
  amountCents: number
}

// Decimal arithmetic is deliberately separate from the payment ledger. These
// totals are estimates only and must never be used to authorize a withdrawal.
export function displayMoneyTotal(
  totals: DisplayMoneyTotal[],
  target: PaymentCurrency,
  rates: DisplayExchangeRate[],
  now: number
): { amountCents: number | null, estimated: boolean } {
  let result = 0n
  let estimated = false
  for (const total of totals) {
    if (!Number.isSafeInteger(total.amountCents)) return { amountCents: null, estimated }
    if (!total.amountCents) continue
    if (total.currency === target) {
      result += BigInt(total.amountCents)
      continue
    }
    estimated = true
    const quote = rates.find(rate => rate.from === total.currency && rate.to === target
      && Date.parse(rate.expiresAt) > now)
    if (!quote || !/^\d{1,18}(?:\.\d{1,18})?$/.test(quote.rate)) return { amountCents: null, estimated }
    const [whole, fraction = ''] = quote.rate.split('.')
    const coefficient = BigInt(`${whole}${fraction}`)
    if (coefficient <= 0n) return { amountCents: null, estimated }
    const scale = 10n ** BigInt(fraction.length)
    const numerator = quote.inverse ? scale : coefficient
    const denominator = quote.inverse ? coefficient : scale
    const product = BigInt(total.amountCents) * numerator
    const magnitude = product < 0n ? -product : product
    const rounded = (magnitude + denominator / 2n) / denominator
    result += product < 0n ? -rounded : rounded
  }
  const amountCents = Number(result)
  return { amountCents: Number.isSafeInteger(amountCents) ? amountCents : null, estimated }
}
