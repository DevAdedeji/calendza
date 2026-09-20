import type { PublicPersonalBranding } from '#shared/branding'
import type { PaymentCurrency } from '#shared/payments'

export interface PublicProfile {
  name: string
  username: string
  bio: string | null
  avatarUrl: string | null
  branding: PublicPersonalBranding
  eventTypes: Array<{
    slug: string
    title: string
    description: string | null
    durationMinutes: number
    durationOptionsMinutes: number[]
    paymentEnabled: boolean
    priceCents: number | null
    paymentCurrency: 'USD' | 'NGN'
  }>
}

export interface CurrentProfile {
  id: string
  name: string
  email: string
  emailVerified: boolean
  username: string
  bio: string | null
  avatarUrl: string | null
  timeZone: string
  preferredCurrency: PaymentCurrency | null
  twoFactorEnabled: boolean
  hasPassword: boolean
}

export const profileApi = {
  updateCurrency: (preferredCurrency: PaymentCurrency) => $fetch<{ preferredCurrency: PaymentCurrency }>('/api/profile/currency', {
    method: 'PATCH', body: { preferredCurrency }
  }),
  update: (body: { name: string, bio?: string }) => $fetch<{ user: CurrentProfile }>('/api/profile', { method: 'PATCH', body }),
  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append('avatar', file)
    return $fetch<{ avatarUrl: string }>('/api/profile/avatar', { method: 'PUT', body })
  },
  removeAvatar: () => $fetch('/api/profile/avatar', { method: 'DELETE' })
}

export interface UsernameAvailability {
  available: boolean
  reason: 'invalid' | 'taken' | null
  message: string
}

export const usernameApi = {
  check: (username: string, signal?: AbortSignal) => $fetch<UsernameAvailability>('/api/username-available', {
    query: { username },
    signal
  })
}
