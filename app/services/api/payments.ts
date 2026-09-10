import type { PaginationMeta } from '#shared/pagination'
import { resource } from '@/services/api/http'

export interface PaymentAccountSummary {
  configured: boolean
  status: 'not_started' | 'onboarding' | 'pending_review' | 'active' | 'restricted' | 'disabled' | 'unavailable'
  ready: boolean
  nextAction: 'provider_onboarding' | 'none'
  lastError: string | null
  lastCheckedAt: string | null
  platformFeeBps: number
}

export interface PaymentActivityRecord {
  id: string
  kind: 'checkout' | 'customer_payment' | 'platform_fee' | 'processing_fee' | 'settlement' | 'refund'
  direction: 'none' | 'in' | 'out'
  status: 'pending' | 'succeeded' | 'failed' | 'expired'
  amountCents: number | null
  currency: 'USD' | 'NGN'
  provider: 'bachs'
  providerEventId: string | null
  providerObjectId: string | null
  message: string | null
  metadata: Record<string, string | number | boolean | null>
  occurredAt: string
  paymentReference: string
  platformFeeCents: number | null
  attendeeName: string
  attendeeEmail: string
  eventTitle: string
  label: string
  icon: string
  from: string
  to: string
  owner: string
  bookingPath: string
}

export interface PaymentActivityResponse {
  items: PaymentActivityRecord[]
  pagination: PaginationMeta
}

export interface PaymentMoneyTotal {
  currency: 'USD' | 'NGN'
  amountCents: number
}

export interface PaymentSummary {
  collected: PaymentMoneyTotal[]
  available: PaymentMoneyTotal[]
  pending: PaymentMoneyTotal[]
  withdrawn: PaymentMoneyTotal[]
  providerStatus: 'not_connected' | 'available' | 'unavailable'
  updatedAt: string
}

export interface PaymentWithdrawalDestination {
  id: string
  name: string
  type: 'bank_account' | 'mobile_money' | 'crypto_wallet'
  currency: 'USD' | 'NGN'
  isDefault: boolean
}

export interface PaymentWithdrawalRecord {
  id: string
  status: 'creating' | 'pending' | 'processing' | 'completed' | 'failed' | 'unknown'
  destinationName: string
  sourceCurrency: 'USD' | 'NGN'
  destinationCurrency: 'USD' | 'NGN'
  requestedAmountCents: number
  deliveredAmountCents: number | null
  feeCents: number | null
  totalDebitedCents: number | null
  failureReason: string | null
  providerPayoutId: string | null
  createdAt: string
  completedAt: string | null
}

export interface PaymentWithdrawalOptions {
  ready: boolean
  status: PaymentAccountSummary['status']
  available: PaymentMoneyTotal[]
  destinations: PaymentWithdrawalDestination[]
  withdrawals: PaymentWithdrawalRecord[]
}

export interface PaymentWithdrawalPreview {
  confirmationToken: string
  sourceCurrency: 'USD' | 'NGN'
  destinationCurrency: 'USD' | 'NGN'
  requestedAmountCents: number
  deliveredAmountCents: number
  feeCents: number | null
  totalDebitedCents: number
  exchangeRate: string | null
  destination: PaymentWithdrawalDestination
  expiresAt: string
}

export const paymentsApi = {
  endpoint: '/api/payment-account',
  teamEndpoint: (slug: string) => resource('/api/teams', slug, '/payment-account'),
  activityEndpoint: (teamSlug?: string) => teamSlug
    ? resource('/api/teams', teamSlug, '/payment-activity')
    : '/api/payment-activity',
  summaryEndpoint: (teamSlug?: string) => teamSlug
    ? resource('/api/teams', teamSlug, '/payment-summary')
    : '/api/payment-summary',
  withdrawalsEndpoint: (teamSlug?: string) => teamSlug
    ? resource('/api/teams', teamSlug, '/payment-withdrawals')
    : '/api/payment-withdrawals',
  withdrawalPreviewEndpoint: (teamSlug?: string) => teamSlug
    ? resource('/api/teams', teamSlug, '/payment-withdrawals/preview')
    : '/api/payment-withdrawals/preview',
  start: (teamSlug?: string) => $fetch<{ url: string, expiresAt: string }>(
    teamSlug ? resource('/api/teams', teamSlug, '/payment-account') : '/api/payment-account',
    { method: 'POST' }
  ),
  previewWithdrawal: (
    body: { destinationId: string, sourceCurrency: 'USD' | 'NGN', amountCents: number },
    teamSlug?: string
  ) => $fetch<PaymentWithdrawalPreview>(
    teamSlug ? resource('/api/teams', teamSlug, '/payment-withdrawals/preview') : '/api/payment-withdrawals/preview',
    { method: 'POST', body }
  ),
  createWithdrawal: (
    body: { requestId: string, confirmationToken: string },
    teamSlug?: string
  ) => $fetch<PaymentWithdrawalRecord>(
    teamSlug ? resource('/api/teams', teamSlug, '/payment-withdrawals') : '/api/payment-withdrawals',
    { method: 'POST', body }
  )
}
