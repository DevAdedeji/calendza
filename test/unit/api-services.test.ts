import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiErrorMessage, resource } from '@/services/api/http'
import { bookingsApi } from '@/services/api/bookings'
import { eventTypesApi, teamEventTypesApi } from '@/services/api/event-types'
import { calendarIntegrationApi, zoomApi } from '@/services/api/integrations'
import { workflowsApi } from '@/services/api/workflows'
import { routingFormsApi } from '@/services/api/routing'
import { schedulesApi } from '@/services/api/schedules'
import { bookingLinksApi } from '@/services/api/booking-links'
import { paymentsApi } from '@/services/api/payments'
import { personalBillingApi } from '@/services/api/billing'
import { teamsApi } from '@/services/api/teams'

afterEach(() => vi.unstubAllGlobals())

describe('domain API contracts', () => {
  it.each([
    ['booking detail', () => bookingsApi.get('a/b'), '/api/booking/a%2Fb', undefined],
    ['event removal', () => eventTypesApi.remove('a/b'), '/api/event-types/a%2Fb', { method: 'DELETE' }],
    ['team event', () => teamEventTypesApi.get('a/b', 'c/d'), '/api/teams/a%2Fb/event-types/c%2Fd', undefined],
    ['calendar settings', () => calendarIntegrationApi('caldav').calendars(), '/api/integrations/caldav/calendars', undefined],
    ['Zoom check', () => zoomApi.check(), '/api/integrations/zoom/check', { method: 'POST' }],
    ['team workflow', () => workflowsApi.remove('c/d', 'a/b'), '/api/teams/a%2Fb/workflows/c%2Fd', { method: 'DELETE' }],
    ['personal routing', () => routingFormsApi.get('a/b'), '/api/routing-forms/a%2Fb', undefined],
    ['schedule duplication', () => schedulesApi.duplicate('a/b'), '/api/schedules/a%2Fb/duplicate', { method: 'POST' }],
    ['link revocation', () => bookingLinksApi.revoke('a/b'), '/api/booking-links/a%2Fb', { method: 'DELETE' }],
    ['personal cancellation', () => personalBillingApi.cancel(), '/api/billing/cancel', { method: 'POST' }],
    ['team address', () => teamsApi.updateAddress('a/b', 'new-team'), '/api/teams/a%2Fb/address', { method: 'PATCH', body: { slug: 'new-team' } }]
  ] as const)('preserves the %s endpoint and request', async (_, invoke, url, options) => {
    const response = { ok: true }
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('$fetch', fetch)
    await expect(invoke()).resolves.toBe(response)
    expect(fetch.mock.calls).toEqual([options === undefined ? [url] : [url, options]])
  })

  it('keeps withdrawal confirmation tokens and request IDs unchanged', async () => {
    const fetch = vi.fn().mockResolvedValue({ id: 'withdrawal' })
    vi.stubGlobal('$fetch', fetch)
    const body = { requestId: 'stable-request', confirmationToken: 'signed-confirmation' }
    await paymentsApi.createWithdrawal(body, 'team/name')
    expect(fetch).toHaveBeenCalledWith('/api/teams/team%2Fname/payment-withdrawals', { method: 'POST', body })
  })
})

describe('shared API helpers', () => {
  it('encodes each resource segment instead of treating IDs as paths', () => {
    expect(resource('/api/teams', 'a/b?c#d', '/members')).toBe('/api/teams/a%2Fb%3Fc%23d/members')
  })

  it.each([null, undefined, false, 'offline', new Error('private internal detail'), { statusMessage: 4 }, { data: { statusMessage: '' } }])('uses the fallback for unusable errors: %j', (failure) => {
    expect(apiErrorMessage(failure, 'Please retry')).toBe('Please retry')
  })

  it('prefers the server error message without exposing arbitrary Error messages', () => {
    expect(apiErrorMessage({ data: { statusMessage: 'Slot is taken' }, statusMessage: 'Conflict' }, 'Retry')).toBe('Slot is taken')
    expect(apiErrorMessage({ statusMessage: 'Not allowed' }, 'Retry')).toBe('Not allowed')
  })
})
