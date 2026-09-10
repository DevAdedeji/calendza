import type { PaginationMeta } from '#shared/pagination'
import { DEFAULT_LIST_PAGE_SIZE } from '@/constants/lists'

export type OperationKind = 'automation' | 'calendar' | 'billing' | 'email' | 'webhook'

export type OperationStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'ignored'

export interface OperationsOverview {
  queues: {
    automation: { pending: number, processing: number, failed: number, stale: number }
    calendar: { pending: number, processing: number, failed: number, stale: number }
    billing: { pending: number, processing: number, failed: number, stale: number }
    email: { pending: number, processing: number, failed: number, stale: number }
    webhook: { processing: number, completed: number, failed: number, ignored: number, stale: number }
  }
  alerts: Array<{
    id: string
    type: string
    severity: 'warning' | 'critical'
    summary: string
    details: Record<string, unknown> | null
    firstSeenAt: string
    lastSeenAt: string
  }>
}

export interface OperationsJob {
  id: string
  kind: OperationKind
  status: string
  attempts: number
  availableAt: string
  lastError: string | null
  provider: string | null
  label: string
  retryable: boolean
  delayed?: boolean
  createdAt: string
  updatedAt: string
}

export interface OperationsJobsResponse {
  items: OperationsJob[]
  pagination: PaginationMeta
}

export interface OperationsDiagnostics {
  database: { ok: boolean, latencyMs: number }
  worker: { ok: boolean, active: number, lastSeenAt: string | null }
  configuration: {
    email: boolean
    google: boolean
    microsoft: boolean
    zoom: boolean
    bachs: boolean
    alertRecipients: number
  }
}

export const operationsApi = {
  overviewEndpoint: '/api/operations/overview' as const,
  jobsEndpoint: '/api/operations/jobs' as const,
  diagnosticsEndpoint: '/api/operations/diagnostics' as const,
  paymentsEndpoint: '/api/operations/payments' as const,
  overview: () => $fetch<OperationsOverview>('/api/operations/overview'),
  jobs: (query: { kind: OperationKind, status: OperationStatus, page: number, pageSize?: number }) =>
    $fetch<OperationsJobsResponse>('/api/operations/jobs', { query: { pageSize: DEFAULT_LIST_PAGE_SIZE, ...query } }),
  diagnostics: () => $fetch<OperationsDiagnostics>('/api/operations/diagnostics'),
  retry: (kind: OperationKind, id: string) => $fetch<{ retried: true }>('/api/operations/retry', {
    method: 'POST', body: { kind, id }
  }),
  retryRefund: (paymentReference: string) => $fetch<{
    retried: true
    providerState: 'pending' | 'paid' | 'failed' | 'unknown'
  }>('/api/operations/refunds/retry', {
    method: 'POST', body: { paymentReference }
  }),
  acknowledgeAlert: (id: string) => $fetch<{ acknowledged: true }>(
    `/api/operations/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' }
  )
}
