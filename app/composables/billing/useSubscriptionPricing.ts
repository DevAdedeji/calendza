import type { BillingInterval, CollectionCurrency } from '#shared/billing'
import { formatSubscriptionMoney, planPriceCents, preferredBillingCurrency } from '#shared/regional-pricing'

export function useSubscriptionPricing() {
  const preference = useCookie<CollectionCurrency | null>('billing-currency', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })
  const initialized = useState('subscription-pricing-initialized', () => false)
  const currency = useState<CollectionCurrency>('subscription-pricing-currency', () => 'USD')
  onMounted(() => {
    if (!initialized.value) {
      currency.value = preference.value === 'NGN' || preference.value === 'USD'
        ? preference.value
        : preferredBillingCurrency(Intl.DateTimeFormat().resolvedOptions().timeZone)
      initialized.value = true
    }
  })

  watch([initialized, currency], ([ready, value]) => {
    if (!ready || import.meta.server) return
    preference.value = value
  }, { immediate: true })

  function price(plan: 'personal' | 'team', interval: BillingInterval, seats = 1): string {
    if (!initialized.value) return '—'
    return formatSubscriptionMoney(
      planPriceCents(plan, interval, currency.value) * seats,
      currency.value
    )
  }

  function monthlyEquivalent(plan: 'personal' | 'team'): string {
    if (!initialized.value) return '—'
    return formatSubscriptionMoney(Math.round(planPriceCents(plan, 'yearly', currency.value) / 12), currency.value)
  }

  return { currency, initialized, ready: initialized, price, monthlyEquivalent }
}
