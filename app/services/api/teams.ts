import type { OrganizationRole, OrganizationEntitlement, InvitableRole } from '#shared/billing'
import type { PaginationMeta } from '#shared/pagination'
import { resource } from '@/services/api/http'

export interface TeamSummary {
  id: string
  name: string
  slug: string
  logo: string | null
  role: OrganizationRole
  joinedAt: string
  entitlement: OrganizationEntitlement
}

export interface TeamPermissions {
  inviteMembers: boolean
  removeMembers: boolean
  changeRoles: boolean
  updateTeam: boolean
  changeAddress: boolean
  transferOwnership: boolean
  manageBilling: boolean
  archiveTeam: boolean
  manageEventTypes: boolean
  viewAllBookings: boolean
}

export interface TeamDetail {
  organization: { id: string, name: string, slug: string, logo: string | null, archived: boolean }
  role: OrganizationRole
  entitlement: OrganizationEntitlement
  permissions: TeamPermissions
}

export interface TeamMemberRecord {
  id: string
  userId: string
  role: OrganizationRole
  joinedAt: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
  timeZone: string
  isYou: boolean
  integrations: { googleMeet: boolean, microsoftTeams: boolean, zoom: boolean }
}

export interface TeamMembersResponse {
  items: TeamMemberRecord[]
  pagination: PaginationMeta
  counts: { all: number, owner: number, admin: number, member: number }
}

export interface TeamInvitationRecord {
  id: string
  email: string
  role: InvitableRole
  expiresAt: string
  createdAt: string
  expired: boolean
  inviterName: string
  inviterEmail: string
}

export interface TeamInvitationsResponse {
  items: TeamInvitationRecord[]
  pagination: PaginationMeta
}

export interface TeamAuditRecord {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  actorName: string | null
  actorEmail: string | null
}

export interface TeamAuditResponse {
  items: TeamAuditRecord[]
  pagination: PaginationMeta
}

export type InvitationState
  = 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired' | 'archived' | 'team_full'

export interface InvitationPreview {
  state: InvitationState
  email: string
  role: InvitableRole
  expiresAt: string
  organization: { name: string, slug: string }
  inviterName: string
}

export interface SlugAvailability {
  available: boolean
  reason: 'invalid' | 'taken' | null
  message: string
}

export const teamsApi = {
  listEndpoint: '/api/teams' as const,
  detailEndpoint: (slug: string) => resource('/api/teams', slug),
  membersEndpoint: (slug: string) => resource('/api/teams', slug, '/members'),
  invitationsEndpoint: (slug: string) => resource('/api/teams', slug, '/invitations'),
  auditEndpoint: (slug: string) => resource('/api/teams', slug, '/audit'),
  slugAvailable: (slug: string) => $fetch<SlugAvailability>('/api/team-slug-available', { query: { slug } }),
  updateAddress: (slug: string, next: string) => $fetch<{ slug: string }>(
    resource('/api/teams', slug, '/address'),
    { method: 'PATCH', body: { slug: next } }
  ),
  transferOwnership: (slug: string, memberId: string) => $fetch<{ ownerMemberId: string, yourRole: 'admin' }>(
    resource('/api/teams', slug, '/transfer-ownership'),
    { method: 'POST', body: { memberId } }
  ),
  archive: (slug: string, confirmation: string) => $fetch<{ archived: true, cancelledBookings: number }>(
    resource('/api/teams', slug, '/archive'),
    { method: 'POST', body: { confirmation } }
  )
}

export const teamAuditApi = {
  listEndpoint: (slug: string) => resource('/api/teams', slug, '/audit')
}

export const invitationsApi = {
  previewEndpoint: (id: string) => resource('/api/invitations', id),
  preview: (id: string) => $fetch<InvitationPreview>(resource('/api/invitations', id))
}
