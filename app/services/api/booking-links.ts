import type { PaginationMeta } from '#shared/pagination'
import type { CreateBookingLinkInput } from '#shared/booking-links'
import { resource } from '@/services/api/http'

export interface BookingLinkRecord {
  id: string
  kind: 'single_use' | 'one_off'
  label: string | null
  eventTypeId: string
  eventTitle: string
  eventSlug: string
  status: 'available' | 'booked' | 'expired' | 'revoked'
  expiresAt: string
  usedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface BookingLinksResponse {
  items: BookingLinkRecord[]
  counts: { all: number, available: number, booked: number, closed: number }
  pagination: PaginationMeta
}

export const bookingLinksApi = {
  listEndpoint: '/api/booking-links' as const,
  optionsEndpoint: '/api/booking-links/options' as const,
  create: (body: CreateBookingLinkInput) => $fetch<{ id: string, token: string, path: string, expiresAt: string }>(
    '/api/booking-links', { method: 'POST', body }
  ),
  revoke: (id: string) => $fetch(resource('/api/booking-links', id), { method: 'DELETE' })
}
