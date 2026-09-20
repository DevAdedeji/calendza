import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { displayMoneyTotal, type DisplayExchangeRate, type DisplayMoneyTotal } from '#shared/payment-display'
import { formatMoney, type PaymentCurrency } from '#shared/payments'

export function usePaymentMoneyDisplay(
  currency: MaybeRefOrGetter<PaymentCurrency>,
  rates: MaybeRefOrGetter<DisplayExchangeRate[]>
) {
  const now = ref(Date.now())
  let expiry: ReturnType<typeof setTimeout> | undefined
  const stop = watch([() => toValue(rates), now], () => {
    clearTimeout(expiry)
    if (import.meta.server) return
    const next = Math.min(...toValue(rates).map(rate => Date.parse(rate.expiresAt)).filter(time => time > now.value))
    if (Number.isFinite(next)) {
      expiry = setTimeout(() => {
        now.value = Date.now()
      }, Math.max(0, next - Date.now()) + 1)
    }
  }, { immediate: true })
  onScopeDispose(() => {
    stop()
    clearTimeout(expiry)
  })

  const activeRates = computed(() => toValue(rates).filter(rate => Date.parse(rate.expiresAt) > now.value))
  function amount(totals: DisplayMoneyTotal[] = [], empty = 'No settled funds') {
    const result = displayMoneyTotal(totals, toValue(currency), activeRates.value, Date.now())
    if (result.amountCents === null) return 'Conversion unavailable'
    if (!totals.some(total => total.amountCents !== 0)) return empty
    return `${result.estimated ? '≈ ' : ''}${formatMoney(result.amountCents, toValue(currency))}`
  }
  return { amount, activeRates }
}
