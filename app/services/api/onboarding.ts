import type { BookingSetupStatus, FirstBookingSetupInput } from '#shared/onboarding'
import type { MeetingLocationType } from '#shared/validation'

export type FirstBookingSetup = FirstBookingSetupInput & {
  status: BookingSetupStatus
  availableLocations: MeetingLocationType[]
}

export const onboardingApi = {
  endpoint: '/api/onboarding' as const,
  complete: (body: FirstBookingSetupInput) => $fetch<{ slug: string }>('/api/onboarding', { method: 'POST', body }),
  skip: () => $fetch('/api/onboarding/skip', { method: 'POST' })
}
