import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useAccountMoneyDisplay } from '@/composables/payments/useAccountMoneyDisplay'
import type { DisplayExchangeRate } from '#shared/payment-display'

const profile = ref<{ user: { id: string, preferredCurrency: 'USD' | 'NGN', timeZone: string } | null }>({ user: null })
const rates = ref<DisplayExchangeRate[]>([])
const status = ref('success')
const scopes: EffectScope[] = []
function display() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useAccountMoneyDisplay())!
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
  profile.value = { user: { id: 'host', preferredCurrency: 'NGN', timeZone: 'Africa/Lagos' } }
  rates.value = [{ from: 'USD', to: 'NGN', rate: '1500', quotedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300_000).toISOString() }]
  status.value = 'success'
  vi.stubGlobal('useNuxtData', () => ({ data: profile }))
  vi.stubGlobal('useLazyFetch', vi.fn(() => ({ data: rates, status, refresh: vi.fn() })))
})
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('account-wide money display', () => {
  it('updates balance, activity, invoice and booking displays together when the preference changes', () => {
    const payment = display()
    const booking = display()
    expect(payment.total([{ currency: 'USD', amountCents: 950 }])).toBe('≈ NGN\u00a014,250.00')
    expect(booking.money(500, 'USD')).toBe('≈ NGN\u00a07,500.00')
    expect(payment.invoiceAmount({ amountCents: 600, collectionCurrency: 'USD', collectionAmount: '6.00' })).toBe('≈ NGN\u00a09,000.00')
    profile.value.user!.preferredCurrency = 'USD'
    expect(payment.total([{ currency: 'USD', amountCents: 950 }])).toBe('$9.50')
    expect(booking.money(500, 'USD')).toBe('$5.00')
  })
  it('distinguishes a loading rate from an unavailable conversion and never substitutes zero', () => {
    const { money } = display()
    rates.value = []
    status.value = 'pending'
    expect(money(950, 'USD')).toBe('Loading conversion…')
    status.value = 'success'
    expect(money(950, 'USD')).toBe('Conversion unavailable')
    expect(money(0, 'USD')).toBe('NGN\u00a00.00')
  })
  it('expires visible rates and recovers when refreshed without a page reload', async () => {
    const { money, activeRates } = display()
    await vi.advanceTimersByTimeAsync(300_001)
    expect(activeRates.value).toEqual([])
    expect(money(950, 'USD')).toBe('Conversion unavailable')
    rates.value = [{ ...rates.value[0]!, expiresAt: new Date(Date.now() + 300_000).toISOString() }]
    await nextTick()
    expect(money(950, 'USD')).toBe('≈ NGN\u00a014,250.00')
  })
  it('keeps unsigned guest receipts in their actual transaction currency and does not fetch protected rates', () => {
    profile.value.user = null
    expect(display().money(950, 'USD')).toBe('$9.50')
    expect(useLazyFetch).toHaveBeenCalledWith('/api/payment-display-rates', expect.objectContaining({ immediate: false }))
  })
  it('never treats a missing NGN invoice collection amount as a USD amount', () => {
    expect(display().invoiceAmount({ amountCents: 600, collectionCurrency: 'NGN', collectionAmount: null })).toBe('Amount unavailable')
  })
})
