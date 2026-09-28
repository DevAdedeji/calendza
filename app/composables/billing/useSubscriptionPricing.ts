import type { BillingInterval } from '#shared/billing'
import { formatSubscriptionMoney, planPriceCents } from '#shared/regional-pricing'

export function useSubscriptionPricing() {
  // Subscription prices must not follow the account's balance-display currency.
  const currency = computed(() => 'USD' as const)
  const ready = computed(() => true)

  function price(plan: 'personal' | 'team', interval: BillingInterval, seats = 1): string {
    return formatSubscriptionMoney(planPriceCents(plan, interval) * seats, 'USD')
  }

  function monthlyEquivalent(plan: 'personal' | 'team'): string {
    return formatSubscriptionMoney(Math.round(planPriceCents(plan, 'yearly') / 12), 'USD')
  }

  return { currency, ready, price, monthlyEquivalent }
}
