import type { BillingInterval, CollectionCurrency, OrganizationEntitlement, PersonalPlanEntitlement } from '#shared/billing'
import { resource } from '@/services/api/http'

export interface TeamInvoiceRecord {
  id: string
  reference: string
  status: 'pending' | 'paid' | 'failed' | 'expired'
  interval: BillingInterval
  seats: number
  amountCents: number
  collectionCurrency: CollectionCurrency
  collectionAmount: string | null
  periodStart: string
  periodEnd: string
  paidAt: string | null
  createdAt: string
}

export interface TeamBillingResponse {
  entitlement: OrganizationEntitlement
  configured: boolean
  seatBilling: {
    billedSeats: number | null
    collectionMethod: 'charge_automatically' | 'invoice'
    collectionCurrency: CollectionCurrency
    syncStatus: 'pending' | 'processing' | 'completed' | 'failed' | null
    hasError: boolean
    updatedAt: string | null
  }
  invoices: TeamInvoiceRecord[]
}

export const billingApi = {
  summaryEndpoint: (slug: string) => resource('/api/teams', slug, '/billing'),
  syncSeats: (slug: string) => $fetch<{ queued: true }>(
    resource('/api/teams', slug, '/billing/sync-seats'),
    { method: 'POST' }
  ),
  checkout: (slug: string, body: { interval: BillingInterval, currency: CollectionCurrency }) =>
    $fetch<{ checkoutUrl: string, reference: string }>(
      resource('/api/teams', slug, '/billing/checkout'),
      { method: 'POST', body }
    )
}

export interface PersonalBillingResponse {
  entitlement: PersonalPlanEntitlement
  configured: boolean
  payment: {
    collectionMethod: 'charge_automatically' | 'invoice'
    collectionCurrency: CollectionCurrency
  }
  invoices: Array<{
    id: string
    reference: string
    status: 'pending' | 'paid' | 'failed' | 'expired'
    interval: BillingInterval
    amountCents: number
    collectionCurrency: CollectionCurrency
    collectionAmount: string | null
    periodStart: string
    periodEnd: string
    paidAt: string | null
    createdAt: string
  }>
}

export const personalBillingApi = {
  summaryEndpoint: '/api/billing' as const,
  checkout: (body: { interval: BillingInterval, currency: CollectionCurrency, requestId: string }) =>
    $fetch<{ checkoutUrl: string, reference: string }>('/api/billing/checkout', { method: 'POST', body }),
  cancel: () => $fetch<{ cancelAtPeriodEnd: boolean, currentPeriodEnd: string | null, autoRenews: boolean }>(
    '/api/billing/cancel',
    { method: 'POST' }
  )
}
