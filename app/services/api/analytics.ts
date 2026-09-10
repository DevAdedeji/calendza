import { resource } from '@/services/api/http'

export interface AnalyticsResponse {
  range: { days: 7 | 30 | 90, from: string, to: string }
  scope: 'personal' | 'team' | 'mine'
  summary: {
    total: number
    confirmed: number
    pending: number
    cancelled: number
    completed: number
    noShows: number
    noShowRate: number
    cancellationRate: number
    completionRate: number
    averageLeadHours: number
    totalChange: number | null
    confirmedChange: number | null
  }
  daily: Array<{ date: string, value: number }>
  sources: { hosted: number, embed: number }
  revenue: Array<{ currency: 'USD' | 'NGN', amountCents: number }>
  eventTypes: Array<{
    id: string
    title: string
    total: number
    confirmed: number
    cancelled: number
    noShows: number
    cancellationRate: number
    noShowRate: number
  }>
  options: Array<{ id: string, title: string }>
}

export const analyticsApi = {
  endpoint: (teamSlug?: string) => teamSlug ? resource('/api/teams', teamSlug, '/analytics') : '/api/analytics'
}
