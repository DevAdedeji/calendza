import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'
import { useAccountCurrency } from '@/composables/useAccountCurrency'
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

describe('USD subscription pricing independent of account preferences', () => {
  it('keeps subscription prices in USD for an NGN account', () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'NGN' }
    const pricing = useSubscriptionPricing()
    expect(pricing.currency.value).toBe('USD')
    expect(pricing.price('personal', 'monthly')).toBe('$6')
    expect(pricing.price('team', 'monthly', 2)).toBe('$16')
    expect(useAccountCurrency().currency.value).toBe('NGN')
    expect(guestPreference.value).toBe('USD')
  })

  it('ignores a legacy NGN cookie and is ready before client hydration', () => {
    const update = vi.spyOn(profileApi, 'updateCurrency')
    guestPreference.value = 'NGN'
    const pricing = useSubscriptionPricing()
    const other = useSubscriptionPricing()
    expect(pricing.ready.value).toBe(true)
    expect(pricing.price('personal', 'yearly')).toBe('$60')
    expect(other.price('team', 'yearly')).toBe('$80')
    expect(other.currency.value).toBe('USD')
    expect(guestPreference.value).toBe('NGN')
    expect(update).not.toHaveBeenCalled()
  })

  it('still saves the account display currency without changing subscription prices', async () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'USD' }
    vi.spyOn(profileApi, 'updateCurrency').mockResolvedValue({ preferredCurrency: 'NGN' })
    const pricing = useSubscriptionPricing()
    const account = useAccountCurrency()
    await account.saveCurrency('NGN')
    expect(account.currency.value).toBe('NGN')
    expect(pricing.price('personal', 'monthly')).toBe('$6')
    expect(guestPreference.value).toBe('USD')
    current.value.user = null
    expect(pricing.currency.value).toBe('USD')
  })

  it('still rejects a failed account preference update', async () => {
    current.value.user = { id: 'one', timeZone: 'UTC', preferredCurrency: 'USD' }
    vi.spyOn(profileApi, 'updateCurrency').mockRejectedValue(new Error('Failed'))
    const pricing = useSubscriptionPricing()
    const account = useAccountCurrency()
    await expect(account.saveCurrency('NGN')).rejects.toThrow('Failed')
    expect(account.currency.value).toBe('USD')
    expect(pricing.price('personal', 'monthly')).toBe('$6')
  })
})
