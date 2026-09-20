import type { DisplayExchangeRate, DisplayMoneyTotal } from '#shared/payment-display'
import { formatMoney, type PaymentCurrency } from '#shared/payments'
import { decimalAmountCents } from '#shared/regional-pricing'
import { useAccountCurrency } from '@/composables/useAccountCurrency'
import { usePaymentMoneyDisplay } from '@/composables/payments/usePaymentMoneyDisplay'

export function useAccountMoneyDisplay() {
  const { currency, user, saveCurrency } = useAccountCurrency()
  // Rates contain no account balances. Share one request across all money
  // components on the page; the server caches Bachs quotes for five minutes.
  const { data: rates, status, refresh: refreshRates } = useLazyFetch<DisplayExchangeRate[]>('/api/payment-display-rates', {
    key: 'account-display-rates', server: false, immediate: Boolean(user.value), watch: false
  })
  const { amount, activeRates } = usePaymentMoneyDisplay(currency, () => rates.value ?? [])
  function total(totals: DisplayMoneyTotal[] = [], empty?: string) {
    const result = amount(totals, empty)
    return result === 'Conversion unavailable' && status.value === 'pending' ? 'Loading conversion…' : result
  }
  function money(amountCents: number, originalCurrency: PaymentCurrency) {
    if (!user.value) return formatMoney(amountCents, originalCurrency)
    return total([{ amountCents, currency: originalCurrency }], formatMoney(0, currency.value))
  }
  function invoiceAmount(invoice: { amountCents: number, collectionCurrency: string, collectionAmount: string | null }) {
    if (invoice.collectionCurrency !== 'USD' && invoice.collectionCurrency !== 'NGN') return 'Amount unavailable'
    if (invoice.collectionAmount !== null) {
      try {
        return money(decimalAmountCents(invoice.collectionAmount), invoice.collectionCurrency)
      } catch {
        return 'Amount unavailable'
      }
    }
    return invoice.collectionCurrency === 'USD' ? money(invoice.amountCents, 'USD') : 'Amount unavailable'
  }
  return { currency, saveCurrency, money, invoiceAmount, total, activeRates, rates, refreshRates, rateStatus: status }
}
