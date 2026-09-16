import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetEnv, useEnv } from '@@/server/config/env'

const keys = [
  'DATABASE_URL',
  'CALENDZA_URL',
  'AUTH_SECRET',
  'CALENDZA_ENVIRONMENT',
  'INTEGRATION_ENCRYPTION_KEY',
  'BACHS_SECRET_KEY',
  'BACHS_WEBHOOK_SECRET',
  'CALENDZA_BILLING_MODE',
  'CALENDZA_PROCESS_ROLE',
  'PLATFORM_ADMIN_EMAILS',
  'DATABASE_POOL_MAX',
  'SMTP_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM'
] as const

describe('environment validation', () => {
  const original = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const key of keys) original.set(key, process.env[key])
    delete process.env.CALENDZA_PROCESS_ROLE
    process.env.DATABASE_URL = 'postgres://calendza:calendza@localhost:5442/calendza'
    process.env.CALENDZA_URL = 'http://localhost:3002'
    process.env.AUTH_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
    delete process.env.SMTP_URL
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.CALENDZA_ENVIRONMENT
    delete process.env.INTEGRATION_ENCRYPTION_KEY
    delete process.env.BACHS_SECRET_KEY
    delete process.env.BACHS_WEBHOOK_SECRET
    delete process.env.CALENDZA_BILLING_MODE
    delete process.env.PLATFORM_ADMIN_EMAILS
    delete process.env.DATABASE_POOL_MAX
    resetEnv()
  })

  afterEach(() => {
    for (const key of keys) {
      const value = original.get(key)
      if (value === undefined) Reflect.deleteProperty(process.env, key)
      else process.env[key] = value
    }
    original.clear()
    resetEnv()
  })

  it('does not include a rejected secret URL in its error message', () => {
    process.env.DATABASE_URL = 'not-a-url-with-a-database-password'

    expect(() => useEnv()).toThrow('DATABASE_URL is not a valid URL.')
    expect(() => useEnv()).not.toThrow(/database-password/)
  })

  it('requires the Calendza public URL', () => {
    delete process.env.CALENDZA_URL
    expect(() => useEnv()).toThrow('Missing environment variables: CALENDZA_URL.')
  })

  it('loads Calendza settings and normalizes the public origin', () => {
    Object.assign(process.env, {
      CALENDZA_URL: 'https://staging.calendza.xyz/',
      CALENDZA_ENVIRONMENT: 'staging',
      CALENDZA_PROCESS_ROLE: 'worker',
      CALENDZA_BILLING_MODE: 'sandbox',
      BACHS_SECRET_KEY: 'sk_sandbox_example',
      BACHS_WEBHOOK_SECRET: 'whsec_example',
      SMTP_URL: 'smtp://localhost:1025',
      EMAIL_FROM: 'Calendza <hello@calendza.xyz>'
    })
    expect(useEnv()).toMatchObject({
      siteUrl: 'https://staging.calendza.xyz', environment: 'staging', processRole: 'worker', billingMode: 'sandbox'
    })
  })

  it.each([
    'https://calendza.xyz/path', 'https://calendza.xyz?token=secret',
    'https://calendza.xyz#fragment', 'https://user:secret@calendza.xyz'
  ])('rejects non-origin site configuration without exposing credentials: %s', (url) => {
    process.env.CALENDZA_URL = url
    expect(() => useEnv()).toThrow('CALENDZA_URL must be an origin')
    expect(() => useEnv()).not.toThrow(/secret/)
  })

  it('requires HTTPS and independent credential encryption in production', () => {
    process.env.CALENDZA_ENVIRONMENT = 'production'
    expect(() => useEnv()).toThrow('Production CALENDZA_URL must use HTTPS.')

    resetEnv()
    process.env.CALENDZA_URL = 'https://calendza.example'
    expect(() => useEnv()).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production')
  })

  it('rejects sandbox payment credentials in production', () => {
    process.env.CALENDZA_ENVIRONMENT = 'production'
    process.env.CALENDZA_URL = 'https://calendza.example'
    process.env.INTEGRATION_ENCRYPTION_KEY = 'separate-encryption-key-that-is-long-enough'
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_example'
    process.env.BACHS_WEBHOOK_SECRET = 'whsec_example'
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@calendza.example'

    expect(() => useEnv()).toThrow('Production requires a BACHS_SECRET_KEY beginning with sk_live_.')
  })

  it('accepts a fully configured production environment', () => {
    process.env.CALENDZA_ENVIRONMENT = 'production'
    process.env.CALENDZA_URL = 'https://calendza.example'
    process.env.INTEGRATION_ENCRYPTION_KEY = 'separate-encryption-key-that-is-long-enough'
    process.env.BACHS_SECRET_KEY = 'sk_live_example'
    process.env.BACHS_WEBHOOK_SECRET = 'whsec_example'
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@calendza.example'
    process.env.RESEND_API_KEY = 're_example'
    process.env.EMAIL_FROM = 'Calendza <hello@calendza.example>'

    expect(useEnv().environment).toBe('production')
    expect(useEnv().billingMode).toBe('live')
    expect(useEnv().emailDeliveryMode).toBe('resend')
  })

  it('allows an explicitly sandboxed portfolio deployment without weakening production protections', () => {
    Object.assign(process.env, {
      CALENDZA_ENVIRONMENT: 'production',
      CALENDZA_URL: 'https://calendza.example',
      CALENDZA_BILLING_MODE: 'sandbox',
      INTEGRATION_ENCRYPTION_KEY: 'separate-encryption-key-that-is-long-enough',
      BACHS_SECRET_KEY: 'sk_sandbox_example',
      BACHS_WEBHOOK_SECRET: 'whsec_example',
      PLATFORM_ADMIN_EMAILS: 'admin@calendza.example',
      RESEND_API_KEY: 're_example',
      EMAIL_FROM: 'Calendza <hello@calendza.example>'
    })
    expect(useEnv().environment).toBe('production')
    expect(useEnv().billingMode).toBe('sandbox')
    resetEnv()
    delete process.env.INTEGRATION_ENCRYPTION_KEY
    expect(() => useEnv()).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production')
  })

  it('rejects a sandbox label with a live key and rejects unknown billing modes', () => {
    process.env.CALENDZA_BILLING_MODE = 'sandbox'
    process.env.BACHS_SECRET_KEY = 'sk_live_example'
    expect(() => useEnv()).toThrow('CALENDZA_BILLING_MODE must match')
    resetEnv()
    process.env.CALENDZA_BILLING_MODE = 'demo'
    expect(() => useEnv()).toThrow('CALENDZA_BILLING_MODE must be sandbox or live.')
  })

  it('keeps sandbox payment credentials valid on staging', () => {
    process.env.CALENDZA_URL = 'https://staging.calendza.example'
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_example'
    process.env.BACHS_WEBHOOK_SECRET = 'whsec_example'
    process.env.RESEND_API_KEY = 're_example'
    process.env.EMAIL_FROM = 'Calendza <hello@calendza.example>'

    expect(useEnv().environment).toBe('staging')
    expect(useEnv().emailDeliveryMode).toBe('resend')
  })

  it('logs local emails even with both Resend and SMTP credentials configured', () => {
    process.env.RESEND_API_KEY = 're_example'
    process.env.SMTP_URL = 'smtp://localhost:1025'
    expect(useEnv().emailDeliveryMode).toBe('log')
  })

  it.each(['http://localhost:3002', 'http://127.0.0.1:3002', 'http://[::1]:3002'])('recognizes local email previews at %s', (url) => {
    process.env.CALENDZA_URL = url
    expect(useEnv()).toMatchObject({ environment: 'development', emailDeliveryMode: 'log' })
  })

  it('logs explicitly development emails without requiring a provider', () => {
    process.env.CALENDZA_URL = 'https://dev.calendza.example'
    process.env.CALENDZA_ENVIRONMENT = 'development'
    expect(useEnv().emailDeliveryMode).toBe('log')
  })

  it('requires real email configuration for staging, even on a local URL', () => {
    process.env.CALENDZA_ENVIRONMENT = 'staging'
    expect(() => useEnv()).toThrow('Configure SMTP_URL or RESEND_API_KEY')
    process.env.RESEND_API_KEY = 're_example'
    expect(() => useEnv()).toThrow('EMAIL_FROM is required')
    process.env.EMAIL_FROM = 'Calendza <hello@calendza.example>'
    expect(useEnv().emailDeliveryMode).toBe('resend')
  })

  it('preserves the configured SMTP transport on staging', () => {
    process.env.CALENDZA_ENVIRONMENT = 'staging'
    process.env.SMTP_URL = 'smtp://localhost:1025'
    process.env.EMAIL_FROM = 'Calendza <hello@calendza.example>'
    expect(useEnv().emailDeliveryMode).toBe('smtp')
  })

  it('validates and exposes database connection budgets', () => {
    process.env.DATABASE_POOL_MAX = '7'
    expect(useEnv().databasePoolMax).toBe(7)

    resetEnv()
    process.env.DATABASE_POOL_MAX = '0'
    expect(() => useEnv()).toThrow('DATABASE_POOL_MAX must be an integer between 1 and 50.')

    resetEnv()
    process.env.DATABASE_POOL_MAX = '7workers'
    expect(() => useEnv()).toThrow('DATABASE_POOL_MAX must be an integer between 1 and 50.')
  })
})
