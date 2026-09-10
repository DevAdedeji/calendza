export interface CalendarConnection {
  connected: boolean
  configured: boolean
  status?: 'active' | 'needs_reauthorization' | 'disconnected'
  setupRequired?: boolean
  writeEnabled?: boolean
  defaultForBookings?: boolean
  supportsMicrosoftTeams?: boolean
  accountLabel?: string | null
  conflictCalendarIds?: string[]
  writeCalendarId?: string | null
  lastError?: string | null
  lastCheckedAt?: string | null
}

export type VideoConferenceConnection = Pick<CalendarConnection,
  'connected' | 'configured' | 'status' | 'accountLabel' | 'lastError'>

export interface CalendarItem {
  id: string
  summary: string
  primary: boolean
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
  backgroundColor?: string
  unavailable?: boolean
  shared?: boolean
  owner?: string
}

export interface CalendarsResponse {
  items: CalendarItem[]
  conflictCalendarIds: string[]
  writeCalendarId: string | null
}

export type CalendarIntegrationProvider = 'google-calendar' | 'microsoft-calendar' | 'caldav'

export function calendarIntegrationApi(provider: CalendarIntegrationProvider) {
  const endpoint = `/api/integrations/${provider}` as const
  return {
    connectionEndpoint: endpoint,
    connectEndpoint: `${endpoint}/connect`,
    connect: (body: { username: string, password: string }) =>
      $fetch<CalendarConnection>(`${endpoint}/connect`, { method: 'POST', body }),
    calendars: () => $fetch<CalendarsResponse>(`${endpoint}/calendars`),
    update: (body: { conflictCalendarIds: string[], writeCalendarId: string | null, defaultForBookings?: boolean }) =>
      $fetch<{ ok: true, syncQueued: boolean }>(endpoint, { method: 'PATCH', body }),
    disconnect: () => $fetch(endpoint, { method: 'DELETE' })
  }
}

export interface IntegrationSyncHealth {
  pending: number
  processing: number
  failed: number
  lastError: string | null
  failureProvider: 'google' | 'microsoft' | 'caldav' | 'zoom' | null
  retryableProviderCounts: Partial<Record<'google' | 'microsoft' | 'caldav' | 'zoom', number>>
}

export const integrationHealthApi = {
  endpoint: '/api/integrations/health' as const,
  retry: (provider?: 'google' | 'microsoft' | 'caldav' | 'zoom') => $fetch<{ retried: number }>('/api/integrations/retry', {
    method: 'POST',
    body: provider ? { provider } : {}
  })
}

export const zoomApi = {
  connectionEndpoint: '/api/integrations/zoom' as const,
  check: () => $fetch<VideoConferenceConnection>('/api/integrations/zoom/check', { method: 'POST' }),
  disconnect: () => $fetch('/api/integrations/zoom', { method: 'DELETE' })
}
