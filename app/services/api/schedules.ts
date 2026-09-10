import type { ScheduleRecord, ScheduleRuleRecord, ScheduleOverrideRecord } from '@/types/schedule'
import type { PaginationMeta } from '#shared/pagination'
import { resource } from '@/services/api/http'
import type { AwayPeriodInput } from '#shared/away-periods'

export interface SchedulesResponse {
  items: ScheduleRecord[]
  pagination: PaginationMeta
  counts: { all: number, default: number }
}

export interface ScheduleUpdateInput {
  name: string
  timeZone: string
  isDefault: boolean
  rules: ScheduleRuleRecord[]
  overrides: ScheduleOverrideRecord[]
}

export const schedulesApi = {
  listEndpoint: '/api/schedules' as const,
  create: (body: { name: string, timeZone: string }) => $fetch<{ id: string }>('/api/schedules', { method: 'POST', body }),
  duplicate: (id: string) => $fetch<{ id: string }>(resource('/api/schedules', id, '/duplicate'), { method: 'POST' }),
  update: (id: string, body: ScheduleUpdateInput) => $fetch(resource('/api/schedules', id), { method: 'PATCH', body }),
  remove: (id: string) => $fetch(resource('/api/schedules', id), { method: 'DELETE' })
}

export interface AwayPeriodRecord {
  id: string
  name: string
  startDate: string
  endDate: string
  timeZone: string
  conflictingBookingCount: number
  createdAt: string
  updatedAt: string
}

export interface AwayPeriodsResponse {
  items: AwayPeriodRecord[]
  timeZone: string
}

export const awayPeriodsApi = {
  endpoint: '/api/away-periods' as const,
  create: (body: AwayPeriodInput) => $fetch<AwayPeriodRecord>('/api/away-periods', { method: 'POST', body }),
  update: (id: string, body: AwayPeriodInput) => $fetch<AwayPeriodRecord>(resource('/api/away-periods', id), { method: 'PATCH', body }),
  remove: (id: string) => $fetch(resource('/api/away-periods', id), { method: 'DELETE' })
}
