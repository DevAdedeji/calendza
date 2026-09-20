import { computed } from 'vue'
import type { PaymentCurrency } from '#shared/payments'
import { preferredBillingCurrency } from '#shared/regional-pricing'
import { profileApi, type CurrentProfile } from '@/services/api/profiles'

export function useAccountCurrency() {
  const { data } = useNuxtData<{ user: CurrentProfile | null }>('current-user')
  const user = computed(() => data.value?.user)
  const currency = computed(() => user.value?.preferredCurrency
    ?? preferredBillingCurrency(user.value?.timeZone ?? 'UTC'))

  async function saveCurrency(preferredCurrency: PaymentCurrency) {
    const userId = user.value?.id
    if (!userId) throw new Error('Sign in to save your currency preference.')
    const saved = await profileApi.updateCurrency(preferredCurrency)
    // A response for a signed-out account must not update the next account.
    if (data.value?.user?.id === userId) {
      data.value = { ...data.value, user: { ...data.value.user, preferredCurrency: saved.preferredCurrency } }
    }
  }

  return { currency, user, saveCurrency }
}
