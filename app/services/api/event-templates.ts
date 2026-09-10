import type { TeamEventTemplateDefaults, ManagedEventMemberEditableField } from '#shared/validation'
import { resource } from '@/services/api/http'

export interface TeamEventTemplateRecord {
  id: string
  name: string
  defaults: TeamEventTemplateDefaults
  memberEditableFields: ManagedEventMemberEditableField[]
  assignments: Array<{ memberId: string, eventTypeId: string, eventTypeSlug: string }>
  sourceEventTypeId: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TeamEventTemplatesResponse {
  items: TeamEventTemplateRecord[]
  sourceEventTypes: Array<{ id: string, title: string, durationMinutes: number }>
  teamMembers: Array<{ id: string, name: string, username: string }>
}

export interface TeamEventTemplateWriteBody {
  name: string
  sourceEventTypeId: string
  assignmentMemberIds: string[]
  memberEditableFields: ManagedEventMemberEditableField[]
}

export const teamEventTemplatesApi = {
  listEndpoint: (slug: string) => resource('/api/teams', slug, '/event-templates'),
  create: (slug: string, body: TeamEventTemplateWriteBody) =>
    $fetch<{ id: string }>(resource('/api/teams', slug, '/event-templates'), { method: 'POST', body }),
  update: (slug: string, id: string, body: TeamEventTemplateWriteBody) =>
    $fetch<{ id: string }>(`${resource('/api/teams', slug, '/event-templates')}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  archive: (slug: string, id: string) =>
    $fetch(`${resource('/api/teams', slug, '/event-templates')}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
