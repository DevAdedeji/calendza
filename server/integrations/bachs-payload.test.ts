import { describe, expect, it } from 'vitest'
import { bachsSubscriptionSchema, bachsWebhookSchema } from '@@/server/integrations/bachs-payload'

describe('Bachs payload validation', () => {
  it.each([null, [], 'event', 42, {}, { id: [] }, { id: 'event', type: {} }, { id: 'event', data: [] }, { id: 'event', data: { checkout_id: {} } }])('rejects malformed webhook envelopes: %j', (payload) => {
    expect(bachsWebhookSchema.safeParse(payload).success).toBe(false)
  })

  it('accepts additional provider fields without losing subscription data', () => {
    const data = { id: 'sub_1', status: 'active', current_period_end: '2026-10-01T00:00:00Z', metadata: null, future_field: true }
    const event = bachsWebhookSchema.parse({ id: 'evt_1', type: 'customer.subscription.updated', data })
    expect(event.data?.current_period_end).toBe(data.current_period_end)
    expect(bachsSubscriptionSchema.parse(event.data)).toMatchObject({ id: 'sub_1', status: 'active', metadata: null })
  })

  it.each([
    { id: 'sub_1' },
    { id: 'sub_1', status: 'not-a-status' },
    { id: 'sub_1', status: 'active', quantity: -1 },
    { id: 'sub_1', status: 'active', current_period_end: 'not-a-date' }
  ])('rejects invalid subscription state before applying entitlements: %j', (payload) => {
    expect(bachsSubscriptionSchema.safeParse(payload).success).toBe(false)
  })
})
