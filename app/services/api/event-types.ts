import type { EventTypeRecord } from '@/types/event-type'
import type { PaginationMeta } from '#shared/pagination'
import type { EventTypeInput, AssignmentMode, MeetingLocationType, ManagedEventMemberEditableField, TeamEventTypeInput } from '#shared/validation'
import { resource } from '@/services/api/http'
import type { AvailabilityResponse } from '@/services/api/bookings'

export interface EventTypesResponse {
  items: EventTypeRecord[]
  pagination: PaginationMeta
  counts: { all: number, active: number, hidden: number }
}

export const eventTypesApi = {
  listEndpoint: '/api/event-types' as const,
  create: (body: EventTypeInput) => $fetch('/api/event-types', { method: 'POST', body }),
  duplicate: (id: string) => $fetch<{ id: string }>(resource('/api/event-types', id, '/duplicate'), { method: 'POST' }),
  update: (id: string, body: EventTypeInput) => $fetch(resource('/api/event-types', id), { method: 'PATCH', body }),
  remove: (id: string) => $fetch(resource('/api/event-types', id), { method: 'DELETE' }),
  slots: (id: string, query: { from: string, to: string, durationMinutes?: number }) => $fetch<AvailabilityResponse>(
    resource('/api/event-types', id, '/slots'), { query }
  )
}

export interface TeamEventTypeHostRecord {
  eventTypeId: string
  memberId: string
  enabled: boolean
  name: string
  avatarUrl: string | null
}

export interface TeamEventTypeRecord {
  id: string
  slug: string
  title: string
  description: string | null
  durationMinutes: number
  additionalDurationMinutes: number[]
  recurringBookingEnabled: boolean
  recurringBookingMaxOccurrences: number
  maxPerDay: number | null
  maxPerWeek: number | null
  maxPerMonth: number | null
  assignmentMode: AssignmentMode
  locationType: MeetingLocationType
  requiresConfirmation: boolean
  capacity: number
  paymentEnabled: boolean
  priceCents: number | null
  paymentCurrency: 'USD' | 'NGN'
  hidden: boolean
  createdAt: string
  hosts: TeamEventTypeHostRecord[]
  managed: {
    templateId: string
    templateName: string
    assignedUserId: string
    memberEditableFields: ManagedEventMemberEditableField[]
    canPersonalize: boolean
  } | null
}

export type TeamEventTypeDetail = TeamEventTypeInput & {
  hosts: Array<{
    memberId: string
    scheduleId: string | null
    enabled: boolean
    weight: number
  }>
  managed: TeamEventTypeRecord['managed']
}

export interface TeamEventTypesResponse {
  items: TeamEventTypeRecord[]
  pagination: PaginationMeta
  counts: { all: number, active: number, hidden: number }
}

export const teamEventTypesApi = {
  listEndpoint: (slug: string) => resource('/api/teams', slug, '/event-types'),
  detailEndpoint: (slug: string, id: string) =>
    `${resource('/api/teams', slug, '/event-types')}/${encodeURIComponent(id)}`,
  get: (slug: string, id: string) => $fetch<TeamEventTypeDetail>(
    `${resource('/api/teams', slug, '/event-types')}/${encodeURIComponent(id)}`
  ),
  create: (slug: string, body: TeamEventTypeInput) =>
    $fetch<{ id: string }>(resource('/api/teams', slug, '/event-types'), { method: 'POST', body }),
  update: (slug: string, id: string, body: TeamEventTypeInput) =>
    $fetch(`${resource('/api/teams', slug, '/event-types')}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (slug: string, id: string) =>
    $fetch(`${resource('/api/teams', slug, '/event-types')}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
