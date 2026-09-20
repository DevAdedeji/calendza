import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'
import { profileApi } from '@/services/api/profiles'

const current = ref<{ user: { id: string, timeZone: string, preferredCurrency: 'USD' | 'NGN' | null } | null }>({ user: null })
const guestPreference = ref<'USD' | 'NGN' | null>('USD')

beforeEach(() => {
  current.value = { user: null }
  guestPreference.value = 'USD'
  const state = new Map<string, ReturnType<typeof ref>>()
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useNuxtData', () => ({ data: current }))
  vi.stubGlobal('useCookie', () => guestPreference)
  vi.stubGlobal('onMounted', (callback: () => void) => callback())
  vi.stubGlobal('useState', (key: string, initial: () => unknown) => {
    if (!state.has(key)) state.set(key, ref(initial()))
    return state.get(key)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('subscription currency selection', () => {
  it('uses saved account currency instead of an older browser cookie', () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'NGN' }
    const pricing = useSubscriptionPricing()
    expect(pricing.currency.value).toBe('NGN')
    expect(pricing.price('personal', 'monthly')).toBe('₦7,500')
    expect(pricing.price('team', 'monthly', 2)).toBe('₦20,000')
    expect(guestPreference.value).toBe('USD')
  })

  it('shares guest selection between pricing components without writing an account', async () => {
    const update = vi.spyOn(profileApi, 'updateCurrency')
    const pricing = useSubscriptionPricing()
    const other = useSubscriptionPricing()
    await pricing.setCurrency('NGN')
    expect(other.currency.value).toBe('NGN')
    expect(guestPreference.value).toBe('NGN')
    expect(update).not.toHaveBeenCalled()
  })

  it('persists signed-in selections without leaking them into the guest cookie', async () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'USD' }
    vi.spyOn(profileApi, 'updateCurrency').mockResolvedValue({ preferredCurrency: 'NGN' })
    const pricing = useSubscriptionPricing()
    await pricing.setCurrency('NGN')
    expect(pricing.price('personal', 'monthly')).toBe('₦7,500')
    expect(guestPreference.value).toBe('USD')
    current.value.user = null
    expect(pricing.currency.value).toBe('USD')
  })

  it('does not display a currency change when the server rejected it', async () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'USD' }
    vi.spyOn(profileApi, 'updateCurrency').mockRejectedValue(new Error('Failed'))
    const pricing = useSubscriptionPricing()
    await expect(pricing.setCurrency('NGN')).rejects.toThrow('Failed')
    expect(pricing.price('personal', 'monthly')).toBe('$6')
  })
})
