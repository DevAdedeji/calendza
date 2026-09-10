import type { WorkflowTrigger, WorkflowAction, WorkflowInput } from '#shared/workflows'
import type { PaginationMeta } from '#shared/pagination'
import { resource } from '@/services/api/http'

export interface WorkflowRecord {
  id: string
  name: string
  trigger: WorkflowTrigger
  offsetMinutes: number
  action: WorkflowAction
  active: boolean
  eventTypeId: string | null
  eventTypeTitle: string | null
  webhookConfigured: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowsResponse {
  items: WorkflowRecord[]
  pagination: PaginationMeta
}

export interface WorkflowWriteResult {
  id: string
  webhookSecret: string | null
}

function workflowBase(teamSlug?: string) {
  return teamSlug ? resource('/api/teams', teamSlug, '/workflows') : '/api/workflows'
}

export const workflowsApi = {
  listEndpoint: (teamSlug?: string) => workflowBase(teamSlug),
  create: (body: WorkflowInput, teamSlug?: string) =>
    $fetch<WorkflowWriteResult>(workflowBase(teamSlug), { method: 'POST', body }),
  update: (id: string, body: WorkflowInput, teamSlug?: string) =>
    $fetch<WorkflowWriteResult>(`${workflowBase(teamSlug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  setActive: (id: string, active: boolean, teamSlug?: string) =>
    $fetch(`${workflowBase(teamSlug)}/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { active } }),
  remove: (id: string, teamSlug?: string) =>
    $fetch(`${workflowBase(teamSlug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
