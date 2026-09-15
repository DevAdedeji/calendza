import { createCipheriv, createHash } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetEnv } from '@@/server/config/env'

describe('integration credential encryption', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/calendza_test'
    process.env.CALENDZA_URL = 'http://localhost:3002'
    process.env.AUTH_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
    delete process.env.INTEGRATION_ENCRYPTION_KEY
    resetEnv()
  })

  it('round-trips a credential without storing its plaintext', async () => {
    const { decryptCredential, encryptCredential } = await import('@@/server/integrations/calendar/credential-crypto')
    const secret = 'google-refresh-token-value'
    const encrypted = encryptCredential(secret)

    expect(encrypted).toMatch(/^v1\./)
    expect(encrypted).not.toContain(secret)
    expect(decryptCredential(encrypted)).toBe(secret)
  })

  it('rejects a modified authentication tag', async () => {
    const { decryptCredential, encryptCredential } = await import('@@/server/integrations/calendar/credential-crypto')
    const encrypted = encryptCredential('google-refresh-token-value')
    const parts = encrypted.split('.')
    parts[2] = `${parts[2]!.startsWith('A') ? 'B' : 'A'}${parts[2]!.slice(1)}`

    expect(() => decryptCredential(parts.join('.'))).toThrow()
  })

  it('decrypts a saved credential using the Calendza key namespace', async () => {
    const { decryptCredential } = await import('@@/server/integrations/calendar/credential-crypto')
    const encryptionKey = createHash('sha256').update(`calendza:integrations:${process.env.AUTH_SECRET}`).digest()
    const iv = Buffer.alloc(12, 1)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
    const encrypted = Buffer.concat([cipher.update('existing-icloud-password', 'utf8'), cipher.final()])
    const saved = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')

    expect(decryptCredential(saved)).toBe('existing-icloud-password')
  })

  it('derives a stable Google-compatible event id for retry-safe creation', async () => {
    const { googleEventId } = await import('@@/server/integrations/calendar/google')
    const first = googleEventId('booking-uid')

    expect(first).toBe(googleEventId('booking-uid'))
    expect(first).not.toBe(googleEventId('another-booking'))
    expect(first).toMatch(/^[a-v0-9]{5,1024}$/)
  })
})
