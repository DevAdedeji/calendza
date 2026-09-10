import type { RoutingQuestion, RoutingFormInput, RoutingRule } from '#shared/routing'
import { resource } from '@/services/api/http'

export interface RoutingFormSummary {
  id: string
  slug: string
  title: string
  description: string | null
  active: boolean
  questions: RoutingQuestion[]
  defaultEventTitle: string
  responseCount: number
  createdAt: string
}

export interface RoutingFormRecord extends Omit<RoutingFormInput, 'rules'> {
  id: string
  rules: RoutingRule[]
}

export interface RoutingFormsResponse {
  items: RoutingFormSummary[]
  eventTypes: Array<{ id: string, title: string, slug: string }>
}

function routingBase(teamSlug?: string) {
  return teamSlug ? resource('/api/teams', teamSlug, '/routing-forms') : '/api/routing-forms'
}

export const routingFormsApi = {
  listEndpoint: (teamSlug?: string) => routingBase(teamSlug),
  get: (id: string, teamSlug?: string) =>
    $fetch<RoutingFormRecord>(`${routingBase(teamSlug)}/${encodeURIComponent(id)}`),
  create: (body: RoutingFormInput, teamSlug?: string) =>
    $fetch<{ id: string }>(routingBase(teamSlug), { method: 'POST', body }),
  update: (id: string, body: RoutingFormInput, teamSlug?: string) =>
    $fetch<{ id: string }>(`${routingBase(teamSlug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string, teamSlug?: string) =>
    $fetch(`${routingBase(teamSlug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
