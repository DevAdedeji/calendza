import { z } from 'zod'
import { displayMoneyTotal, type DisplayExchangeRate } from '#shared/payment-display'
import { paymentCurrencySchema, type PaymentCurrency } from '#shared/payments'
import { quoteConversion } from '@@/server/integrations/bachs'
import { useEnv } from '@@/server/config/env'
import { logEvent } from '@@/server/observability/logger'

const quoteSchema = z.object({
  from_currency: paymentCurrencySchema,
  to_currency: paymentCurrencySchema,
  from_amount: z.string().regex(/^\d+(?:\.0+)?$/),
  to_amount: z.string().regex(/^\d{1,15}(?:\.\d{1,2})?$/),
  exchange_rate: z.string().regex(/^\d{1,18}(?:\.\d{1,18})?$/).refine(value => Number(value) > 0),
  expires_at: z.iso.datetime({ offset: true })
})

// Two rate-only entries per process, never user balances. Coalesce concurrent
// requests and briefly cache failures to avoid hammering Bachs during outages.
const cache = new Map<PaymentCurrency, { until: number, request: Promise<DisplayExchangeRate | null> }>()
let configuredKey: string | undefined

function displayRate(from: PaymentCurrency): Promise<DisplayExchangeRate | null> {
  const key = useEnv().bachsSecretKey
  if (key !== configuredKey) {
    cache.clear()
    configuredKey = key
  }
  if (!key) return Promise.resolve(null)
  const existing = cache.get(from)
  if (existing && existing.until > Date.now()) return existing.request
  const to = from === 'USD' ? 'NGN' : 'USD'
  // Bachs enforces a 5,000 NGN minimum even for rate-only quote requests.
  const quoteAmount = from === 'NGN' ? '5000.00' : '100.00'
  const entry = { until: Date.now() + 30_000, request: Promise.resolve<DisplayExchangeRate | null>(null) }
  entry.request = (async () => {
    try {
      const quote = quoteSchema.parse(await quoteConversion(from, to, quoteAmount))
      const now = Date.now()
      if (quote.from_currency !== from || quote.to_currency !== to || Number(quote.from_amount) !== Number(quoteAmount) || Date.parse(quote.expires_at) <= now) {
        throw new Error('Invalid display quote')
      }
      // A display estimate is not an executable quote. Keep the timestamp and
      // refresh this reference rate after five minutes, without background jobs.
      const rate: DisplayExchangeRate = { from, to, rate: quote.exchange_rate, quotedAt: new Date(now).toISOString(), expiresAt: new Date(now + 300_000).toISOString() }
      const source = [{ currency: from, amountCents: Number(quoteAmount) * 100 }]
      const [whole, fraction = ''] = quote.to_amount.split('.')
      const quotedCents = Number(BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')))
      // Bachs currently quotes NGN per USD in BOTH directions. Verify the
      // orientation against the returned amounts, never guess or invert a
      // different quote (the two directions can have different spreads).
      if (displayMoneyTotal(source, to, [rate], now).amountCents !== quotedCents) {
        rate.inverse = true
        if (displayMoneyTotal(source, to, [rate], now).amountCents !== quotedCents) throw new Error('Inconsistent display quote')
      }
      entry.until = Date.parse(rate.expiresAt)
      return rate
    } catch {
      entry.until = Date.now() + 10_000
      logEvent('warn', 'payment_display_rate_unavailable', { from, to })
      return null
    }
  })()
  cache.set(from, entry)
  return entry.request
}

export async function paymentDisplayRates(currencies: PaymentCurrency[]): Promise<DisplayExchangeRate[]> {
  const rates = await Promise.all([...new Set(currencies)].map(displayRate))
  return rates.filter((rate): rate is DisplayExchangeRate => rate !== null)
}
