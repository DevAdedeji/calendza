import type { RecurringOccurrencePreview, RecurringBookingRequest } from '#shared/recurrence'

export interface RecurrencePreviewResponse {
  occurrences: RecurringOccurrencePreview[]
}

export const recurrenceApi = {
  preview: (body: {
    mode: 'personal' | 'team'
    owner: string
    slug: string
    start: string
    durationMinutes: number
    timeZone: string
    recurrence: RecurringBookingRequest
  }) => $fetch<RecurrencePreviewResponse>('/api/recurrence-preview', { method: 'POST', body })
}
