import type { PaginationMeta } from '#shared/pagination'
import { resource } from '@/services/api/http'

export interface ControlOverview {
  users: { total: number, verified: number, twoFactor: number, joinedLastThirtyDays: number }
  organizations: { total: number, active: number }
  eventTypes: { total: number, visible: number }
  bookings: { total: number, upcoming: number, createdLastThirtyDays: number }
  subscriptions: { personal: number, teams: number }
  recentUsers: Array<{
    id: string
    name: string
    email: string
    username: string
    emailVerified: boolean
    createdAt: string
  }>
}

export interface ControlUserRecord {
  id: string
  name: string
  email: string
  username: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  timeZone: string
  subscriptionStatus: string
  eventTypeCount: number
  bookingCount: number
  teamCount: number
  providers: string[]
  createdAt: string
}

export interface ControlEventTypeRecord {
  id: string
  title: string
  slug: string
  durationMinutes: number
  additionalDurationMinutes: number[]
  hidden: boolean
  capacity: number
  paymentEnabled: boolean
  bookingCount: number
  createdAt: string
  scope: 'personal' | 'team'
  userId: string | null
  ownerName: string | null
  ownerEmail: string | null
  organizationId: string | null
  organizationName: string | null
  organizationSlug: string | null
}

export interface ControlTeamRecord {
  id: string
  name: string
  slug: string
  archivedAt: string | null
  subscriptionStatus: string
  subscriptionInterval: string | null
  memberCount: number
  eventTypeCount: number
  bookingCount: number
  ownerName: string | null
  ownerEmail: string | null
  createdAt: string
}

export interface ControlBookingRecord {
  uid: string
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  source: string
  eventTypeTitle: string
  hostId: string
  hostName: string
  hostEmail: string
  organizationName: string | null
}

export interface ControlUserDetail {
  user: {
    id: string
    name: string
    email: string
    username: string
    bio: string | null
    avatarUrl: string | null
    timeZone: string
    emailVerified: boolean
    twoFactorEnabled: boolean
    subscriptionStatus: string
    subscriptionInterval: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean | null
    createdAt: string
    updatedAt: string
  }
  authProviders: string[]
  integrations: Array<{
    kind: 'calendar' | 'video'
    provider: string
    accountLabel: string | null
    status: string
    lastCheckedAt: string | null
  }>
  teams: Array<{
    id: string
    name: string
    slug: string
    role: string
    archivedAt: string | null
    joinedAt: string
    subscriptionStatus: string
  }>
  eventTypes: Array<{
    id: string
    title: string
    slug: string
    durationMinutes: number
    hidden: boolean
    bookingCount: number
    scope: 'personal' | 'team'
    organizationId: string | null
    organizationName: string | null
    createdAt: string
  }>
  recentBookings: Array<{
    uid: string
    status: string
    startsAt: string
    endsAt: string
    createdAt: string
    eventTypeTitle: string
    organizationName: string | null
  }>
  counts: { teams: number, eventTypes: number, bookings: number, integrations: number }
}

export interface ControlListResponse<T> {
  items: T[]
  pagination: PaginationMeta
}

export const controlApi = {
  overviewEndpoint: '/api/control/overview' as const,
  usersEndpoint: '/api/control/users' as const,
  eventTypesEndpoint: '/api/control/event-types' as const,
  teamsEndpoint: '/api/control/teams' as const,
  bookingsEndpoint: '/api/control/bookings' as const,
  userEndpoint: (id: string) => resource('/api/control/users', id)
}
