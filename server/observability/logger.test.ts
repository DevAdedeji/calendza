import { describe, expect, it } from 'vitest'
import { sanitizeLogFields } from '@@/server/observability/logger'

describe('structured log sanitization', () => {
  it('redacts secrets and masks email addresses recursively', () => {
    expect(sanitizeLogFields({
      accessToken: 'secret',
      attendeeEmail: 'ada@example.com',
      nested: { cookie: 'session', safe: 'ok' }
    })).toEqual({
      accessToken: '[redacted]',
      attendeeEmail: 'ad***@example.com',
      nested: { cookie: '[redacted]', safe: 'ok' }
    })
  })

  it('keeps safe error identifiers without exposing provider or SQL messages', () => {
    const error = Object.assign(new Error('password=private attendee@example.com'), { code: '23505', statusCode: 409 })
    expect(sanitizeLogFields({ error })).toEqual({ error: { name: 'Error', code: '23505', statusCode: 409 } })
  })

  it('handles cycles, shared objects and bigint without breaking logging', () => {
    const shared = { count: 1n }
    const cyclic: Record<string, unknown> = { shared }
    cyclic.self = cyclic
    const sanitized = sanitizeLogFields({ cyclic, first: shared, second: shared })
    expect(sanitized).toEqual({ cyclic: { shared: { count: '1' }, self: '[circular]' }, first: { count: '1' }, second: { count: '1' } })
    expect(() => JSON.stringify(sanitized)).not.toThrow()
  })

  it('bounds deeply nested values and collection sizes', () => {
    let deep: Record<string, unknown> = { end: true }
    for (let i = 0; i < 20; i++) deep = { next: deep }
    expect(JSON.stringify(sanitizeLogFields({ deep }))).toContain('[truncated]')
    expect(sanitizeLogFields({ items: Array.from({ length: 100 }, () => 'item') }).items).toHaveLength(25)
  })
})
