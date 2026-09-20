import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAccountCurrency } from '@/composables/useAccountCurrency'
import { profileApi } from '@/services/api/profiles'

const current = ref<{ user: { id: string, timeZone: string, preferredCurrency: 'USD' | 'NGN' | null } | null }>({ user: null })

beforeEach(() => {
  current.value = { user: { id: 'one', timeZone: 'Africa/Lagos', preferredCurrency: null } }
  vi.stubGlobal('useNuxtData', () => ({ data: current }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('account currency preference', () => {
  it('uses the account timezone only until an explicit currency is saved', () => {
    const { currency } = useAccountCurrency()
    expect(currency.value).toBe('NGN')
    current.value.user!.preferredCurrency = 'USD'
    expect(currency.value).toBe('USD')
    current.value.user!.timeZone = 'Africa/Lagos'
    expect(currency.value).toBe('USD')
  })

  it('updates the shared account only after a successful save', async () => {
    const update = vi.spyOn(profileApi, 'updateCurrency').mockResolvedValue({ preferredCurrency: 'USD' })
    const first = useAccountCurrency()
    const second = useAccountCurrency()
    await first.saveCurrency('USD')
    expect(update).toHaveBeenCalledWith('USD')
    expect(second.currency.value).toBe('USD')
  })

  it('preserves the previous preference when saving fails', async () => {
    vi.spyOn(profileApi, 'updateCurrency').mockRejectedValue(new Error('offline'))
    const { currency, saveCurrency } = useAccountCurrency()
    await expect(saveCurrency('USD')).rejects.toThrow('offline')
    expect(currency.value).toBe('NGN')
  })

  it('does not apply a late response to another account', async () => {
    let finish!: (value: { preferredCurrency: 'USD' }) => void
    vi.spyOn(profileApi, 'updateCurrency').mockImplementation(() => new Promise((resolve) => {
      finish = resolve
    }))
    const { saveCurrency, currency } = useAccountCurrency()
    const saving = saveCurrency('USD')
    current.value = { user: { id: 'two', timeZone: 'Africa/Lagos', preferredCurrency: 'NGN' } }
    finish({ preferredCurrency: 'USD' })
    await saving
    expect(currency.value).toBe('NGN')
    expect(current.value.user!.id).toBe('two')
  })

  it('requires an account and resets when signed out', async () => {
    const update = vi.spyOn(profileApi, 'updateCurrency')
    const { currency, saveCurrency } = useAccountCurrency()
    current.value = { user: null }
    expect(currency.value).toBe('USD')
    await expect(saveCurrency('NGN')).rejects.toThrow('Sign in')
    expect(update).not.toHaveBeenCalled()
  })
})
