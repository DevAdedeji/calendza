import type { BillingInterval, CollectionCurrency } from '#shared/billing'
import { formatSubscriptionMoney, planPriceCents, preferredBillingCurrency } from '#shared/regional-pricing'
import { useAccountCurrency } from '@/composables/useAccountCurrency'

export function useSubscriptionPricing() {
  const preference = useCookie<CollectionCurrency | null>('billing-currency', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })
  const initialized = useState('subscription-pricing-initialized', () => false)
  const guestCurrency = useState<CollectionCurrency>('subscription-pricing-currency', () => 'USD')
  const { currency: accountCurrency, user, saveCurrency } = useAccountCurrency()
  const currency = computed(() => user.value ? accountCurrency.value : guestCurrency.value)
  onMounted(() => {
    if (!initialized.value) {
      guestCurrency.value = preference.value === 'NGN' || preference.value === 'USD'
        ? preference.value
        : preferredBillingCurrency(Intl.DateTimeFormat().resolvedOptions().timeZone)
      initialized.value = true
    }
  })

  async function setCurrency(value: CollectionCurrency) {
    if (user.value) {
      await saveCurrency(value)
    } else {
      guestCurrency.value = value
      preference.value = value
    }
  }

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

  return { currency, setCurrency, signedIn: computed(() => Boolean(user.value)), initialized, ready: initialized, price, monthlyEquivalent }
}
