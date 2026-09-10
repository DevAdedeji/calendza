import type { MeetingLocationType, BookingAnswer, BookingQuestion, AssignmentMode } from '#shared/validation'
import type { PaginationMeta } from '#shared/pagination'
import type { PublicPersonalBranding } from '#shared/branding'
import type { RecurringBookingRequest } from '#shared/recurrence'
import { resource } from '@/services/api/http'

export interface BookingRecord {
  uid: string
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  attendanceStatus: 'attended' | 'no_show' | null
  startsAt: string
  endsAt: string
  attendeeName: string
  attendeeEmail: string
  attendeeTimeZone: string
  additionalGuestEmails: string[]
  locationType: MeetingLocationType
  locationDetails: string
  meetingUrl: string | null
  eventTitle: string
  notes: string | null
  cancellationReason: string | null
}

export interface BookingDetail {
  uid: string
  status: BookingRecord['status']
  attendanceStatus: BookingRecord['attendanceStatus']
  attendanceUpdatedAt: string | null
  startsAt: string
  endsAt: string
  attendeeName: string
  attendeeEmail: string
  attendeeTimeZone: string
  additionalGuestEmails: string[]
  locationType: MeetingLocationType
  locationDetails: string
  meetingUrl: string | null
  cancellationReason: string | null
  eventTitle: string
  eventSlug: string
  durationMinutes: number
  seriesPosition: number | null
  seriesOccurrenceCount: number | null
  seriesFrequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null
  hostName: string
  hostUsername: string
  teamName: string | null
  teamSlug: string | null
  bookingPath: string
  hosts: Array<{ name: string, isOrganizer: boolean }>
  notes: string | null
  answers: BookingAnswer[]
  canHostManage: boolean
  payment: null | {
    status: 'pending' | 'paid' | 'failed' | 'expired' | 'refund_pending' | 'refunded' | 'refund_failed'
    amountCents: number
    currency: 'USD' | 'NGN'
    checkoutUrl: string | null
    expiresAt: string | null
    recoveryAvailable: boolean
  }
}

export interface CreateBookingResult {
  replayed?: boolean
  start: string
  uid: string
  locationType: MeetingLocationType
  locationDetails: string
  meetingUrl: string | null
  status: BookingRecord['status']
  seriesCount?: number
  occurrences?: Array<{ uid: string, start: string, end: string }>
  checkoutUrl?: string | null
  paymentExpiresAt?: string | null
}

export interface BookingsResponse {
  items: BookingRecord[]
  pagination: PaginationMeta
  counts: { all: number, upcoming: number, pending: number, past: number, cancelled: number, nextWeek: number }
}

export interface PublicBookingPage {
  bookingWindowDays?: number | null
  hostName: string
  title: string
  description: string | null
  durationMinutes: number
  durationOptionsMinutes: number[]
  recurringBookingEnabled: boolean
  recurringBookingMaxOccurrences: number
  locationType: MeetingLocationType
  locationDetails: string
  bookingQuestions: BookingQuestion[]
  requiresConfirmation: boolean
  capacity: number
  paymentEnabled: boolean
  priceCents: number | null
  paymentCurrency: 'USD' | 'NGN'
  branding?: PublicPersonalBranding
}

export interface AvailabilityResponse {
  timeZone: string
  durationMinutes: number
  slots: Array<{ start: string, end: string, availableSeats?: number }>
}

export interface CreateBookingInput {
  username: string
  slug: string
  start: string
  durationMinutes?: number
  requestId?: string
  recurrence?: RecurringBookingRequest
  name: string
  email: string
  timeZone: string
  notes?: string
  answers?: Record<string, string>
  guestEmails?: string[]
  inviteToken?: string
  rescheduleOf?: string
}

export const bookingsApi = {
  listEndpoint: '/api/bookings' as const,
  detailEndpoint: (uid: string) => resource('/api/booking', uid),
  get: (uid: string) => $fetch<BookingDetail>(resource('/api/booking', uid)),
  reconcilePayment: (uid: string) => $fetch<{ status: 'confirmed' | 'pending' | 'failed' | 'expired' | 'refund_pending' }>(
    resource('/api/booking', uid, '/payment-status'),
    { method: 'POST' }
  ),
  create: (body: CreateBookingInput) => $fetch<CreateBookingResult>('/api/bookings', { method: 'POST', body }),
  cancel: (uid: string, reason?: string) => $fetch(resource('/api/booking', uid, '/cancel'), {
    method: 'POST',
    body: { reason }
  }),
  approve: (uid: string) => $fetch(resource('/api/booking', uid, '/approve'), { method: 'POST' }),
  reject: (uid: string, reason?: string) => $fetch(resource('/api/booking', uid, '/reject'), {
    method: 'POST',
    body: { reason }
  }),
  updateAttendance: (uid: string, status: BookingRecord['attendanceStatus']) => $fetch<{
    status: BookingRecord['attendanceStatus']
    unchanged: boolean
  }>(resource('/api/booking', uid, '/attendance'), { method: 'PATCH', body: { status } })
}

export const publicBookingApi = {
  profileEndpoint: (username: string) => resource('/api/profile', username),
  pageEndpoint: (username: string, slug: string) => resource(resource('/api/booking-page', username), slug),
  availabilityEndpoint: '/api/availability' as const
}

export const invitationBookingApi = {
  pageEndpoint: (token: string) => resource('/api/meeting-links/guest', token),
  availabilityEndpoint: (token: string) => resource('/api/meeting-links/guest', token, '/availability')
}

export interface PublicTeamProfile {
  name: string
  slug: string
  logo: string | null
  branding: PublicPersonalBranding
  renamed: boolean
  eventTypes: Array<{
    slug: string
    title: string
    description: string | null
    durationMinutes: number
    durationOptionsMinutes: number[]
    assignmentMode: AssignmentMode
    capacity: number
    paymentEnabled: boolean
    priceCents: number | null
    paymentCurrency: 'USD' | 'NGN'
  }>
}

export interface PublicTeamBookingPage {
  hostName: string
  teamName: string
  teamSlug: string
  title: string
  description: string | null
  durationMinutes: number
  durationOptionsMinutes: number[]
  recurringBookingEnabled: boolean
  recurringBookingMaxOccurrences: number
  assignmentMode: AssignmentMode
  locationType: MeetingLocationType
  locationDetails: string
  bookingQuestions: BookingQuestion[]
  requiresConfirmation: boolean
  capacity: number
  paymentEnabled: boolean
  priceCents: number | null
  paymentCurrency: 'USD' | 'NGN'
  hosts: Array<{ name: string, avatarUrl: string | null }>
  branding: PublicPersonalBranding
}

export interface CreateTeamBookingInput {
  team: string
  slug: string
  start: string
  durationMinutes?: number
  requestId?: string
  recurrence?: RecurringBookingRequest
  name: string
  email: string
  timeZone: string
  notes?: string
  answers?: Record<string, string>
  guestEmails?: string[]
  rescheduleOf?: string
}

export interface TeamBookingRecord {
  uid: string
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  attendanceStatus: 'attended' | 'no_show' | null
  startsAt: string
  endsAt: string
  attendeeName: string
  attendeeEmail: string
  eventTitle: string
  assignmentMode: AssignmentMode
  locationType: MeetingLocationType
  meetingUrl: string | null
  cancellationReason: string | null
  hosts: Array<{ name: string, isOrganizer: boolean }>
}

export interface TeamBookingsResponse {
  items: TeamBookingRecord[]
  pagination: PaginationMeta
  counts: { upcoming: number, pending: number, past: number, cancelled: number }
  scope: 'team' | 'mine'
}

export const publicTeamApi = {
  profileEndpoint: (slug: string) => resource('/api/team-profile', slug),
  pageEndpoint: (slug: string, eventSlug: string) =>
    resource(resource('/api/team-booking-page', slug), eventSlug),
  availabilityEndpoint: '/api/team-availability' as const,
  create: (body: CreateTeamBookingInput) =>
    $fetch<CreateBookingResult & { hostNames: string[] }>('/api/team-bookings', { method: 'POST', body })
}

export const teamBookingsApi = {
  listEndpoint: (slug: string) => resource('/api/teams', slug, '/bookings')
}
