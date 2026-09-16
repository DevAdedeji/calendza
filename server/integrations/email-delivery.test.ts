import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail, type Email } from '@@/server/integrations/email'

const { env, request, sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn()
  return {
    env: {
      environment: 'development',
      emailDeliveryMode: 'log',
      emailFrom: 'Calendza <test@example.com>',
      smtpUrl: 'smtp://localhost:1025',
      resendApiKey: 'configured-test-key'
    },
    request: vi.fn(),
    sendMail,
    createTransport: vi.fn(() => ({ sendMail }))
  }
})

vi.mock('@@/server/config/env', () => ({ useEnv: () => env }))
vi.mock('@@/server/integrations/fetch', () => ({ fetchWithTimeout: request }))
vi.mock('nodemailer', () => ({ default: { createTransport } }))

const message: Email = {
  to: 'local-tester@example.com',
  subject: 'Your test booking',
  heading: 'Booking confirmed',
  body: 'Your meeting is ready.',
  details: [{ label: 'Where', value: 'Video call', url: 'https://meet.example.com/test-room' }],
  action: { label: 'View booking', url: 'http://localhost:3002/booking/test-token' }
}

describe('email delivery environments', () => {
  beforeEach(() => {
    env.environment = 'development'
    env.emailDeliveryMode = 'log'
    request.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
    sendMail.mockReset().mockResolvedValue({ messageId: 'smtp-message' })
    createTransport.mockClear()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('logs recipients, message details and action links without contacting either provider', async () => {
    await expect(sendEmail(message)).resolves.toBeUndefined()

    expect(console.info).toHaveBeenCalledWith('[email:development] Preview only; no email sent', {
      from: env.emailFrom,
      to: message.to,
      subject: message.subject,
      details: message.details,
      text: expect.stringContaining(message.action.url)
    })
    expect(request).not.toHaveBeenCalled()
    expect(createTransport).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(env.resendApiKey)
  })

  it.each(['staging', 'production'])('sends real Resend emails on %s without logging contents', async (environment) => {
    env.environment = environment
    env.emailDeliveryMode = 'resend'
    await sendEmail(message, 'booking-test')

    expect(request).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': 'booking-test' }),
      body: expect.stringContaining('test-token')
    }))
    expect(console.info).not.toHaveBeenCalled()
  })

  it('preserves SMTP delivery outside development', async () => {
    env.environment = 'staging'
    env.emailDeliveryMode = 'smtp'
    await sendEmail(message, 'booking-test')

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: message.to, subject: message.subject }))
    expect(request).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
  })

  it.each(['staging', 'production'])('refuses preview mode on %s without leaking contents', async (environment) => {
    env.environment = environment
    await expect(sendEmail(message)).rejects.toThrow('Email previews are only allowed in development.')
    expect(console.info).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })

  it('still validates development message URLs instead of hiding invalid templates', async () => {
    await expect(sendEmail({ ...message, action: { label: 'Unsafe', url: 'javascript:alert(1)' } }))
      .rejects.toThrow('Email action URL must use HTTP or HTTPS.')
    expect(console.info).not.toHaveBeenCalled()
  })

  it('preserves provider failures for the existing retry system', async () => {
    env.environment = 'production'
    env.emailDeliveryMode = 'resend'
    request.mockResolvedValue(new Response('{}', { status: 503 }))
    await expect(sendEmail(message)).rejects.toMatchObject({ permanent: false, statusCode: 503 })
    expect(console.info).not.toHaveBeenCalled()
  })
})
