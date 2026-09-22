import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAppTestEnvironment, getTestDatabaseUrl } from '@@/test/helpers/database'

const url = getTestDatabaseUrl()

describe.skipIf(!url)('authentication', () => {
  const sql = postgres(url!, { max: 3, onnotice: () => {} })

  const credentials = {
    name: 'Ada Lovelace',
    username: 'ada',
    email: 'ada@example.com',
    password: 'a-long-enough-passphrase',
    timeZone: 'Africa/Lagos'
  }

  async function auth() {
    configureAppTestEnvironment(url!)
    const { resetEnv } = await import('@@/server/config/env')
    resetEnv()
    const { useAuth } = await import('@@/server/services/auth')
    return useAuth()
  }

  async function confirmEmail(email: string) {
    await sql`update users set email_verified = true where email = ${email}`
  }

  afterAll(async () => {
    await sql`truncate table email_outbox, api_rate_limits, rate_limits, sessions, accounts, verifications, bookings, event_types, date_overrides, availability_rules, schedules, users, organizations restart identity cascade`
    await sql.end()
    vi.unstubAllGlobals()
  })

  beforeEach(async () => {
    vi.stubGlobal('createError', (details: { statusCode: number, statusMessage: string }) => Object.assign(new Error(details.statusMessage), details))
    await sql`truncate table email_outbox, api_rate_limits, rate_limits, sessions, accounts, verifications, bookings, event_types, schedules, users, organizations restart identity cascade`
  })

  it('creates an unverified user and a hashed credentials account', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })

    expect(result.user.email).toBe(credentials.email)

    const [user] = await sql<{ id: string, username: string, time_zone: string, email_verified: boolean }[]>`
      select id, username, time_zone, email_verified from users where email = ${credentials.email}
    `
    expect(user?.username).toBe('ada')
    expect(user?.time_zone).toBe('Africa/Lagos')
    expect(user?.email_verified).toBe(false)

    const accounts = await sql`select provider_id, password from accounts where user_id = ${user!.id}`
    expect(accounts).toHaveLength(1)
    expect(accounts[0]!.provider_id).toBe('credential')
    expect(accounts[0]!.password).not.toContain(credentials.password)
  })

  it('prepares availability and a pending setup without creating an event', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })
    const { firstBookingSetup } = await import('@@/server/services/onboarding')
    const setup = await firstBookingSetup(result.user.id)
    expect(setup).toMatchObject({ status: 'pending', event: { title: '', slug: '', durationMinutes: 30 }, schedule: { timeZone: 'Africa/Lagos' } })
    expect(setup?.schedule.rules).toHaveLength(5)
    expect(setup?.availableLocations).not.toContain('zoom')
    const events = await sql`select id from event_types where user_id = ${result.user.id}`
    expect(events).toHaveLength(0)
  })

  it('creates nothing on skip, then creates one event on completion without losing schedule exceptions', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })
    const { firstBookingSetup, skipFirstBookingSetup, completeFirstBookingSetup, ensureAvailabilitySchedule } = await import('@@/server/services/onboarding')
    const { profileForUser } = await import('@@/server/repositories/profile')
    const [schedule] = await sql`select id from schedules where user_id = ${result.user.id}`
    await sql`insert into date_overrides (schedule_id, date) values (${schedule!.id}, '2026-12-25')`
    await skipFirstBookingSetup(result.user.id)
    expect(await profileForUser(result.user.id)).toMatchObject({ bookingSetupStatus: 'skipped' })
    await ensureAvailabilitySchedule(result.user.id, 'Africa/Lagos')
    expect(await sql`select id from event_types where user_id = ${result.user.id}`).toHaveLength(0)
    const setup = await firstBookingSetup(result.user.id)
    const input = {
      event: { ...setup!.event, title: 'Discovery call', slug: 'discovery', durationMinutes: 45 },
      schedule: { timeZone: 'Europe/London', rules: [{ weekday: 2, start: '10:00', end: '14:00' }] }
    }
    await expect(completeFirstBookingSetup(result.user.id, input)).resolves.toEqual({ slug: 'discovery' })
    expect(await profileForUser(result.user.id)).toMatchObject({ bookingSetupStatus: 'completed', timeZone: 'Europe/London' })
    const events = await sql`select id, slug, buffer_after_minutes from event_types where user_id = ${result.user.id}`
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ slug: 'discovery', buffer_after_minutes: 0 })
    expect((await firstBookingSetup(result.user.id))?.schedule).toEqual(input.schedule)
    expect(await sql`select id from date_overrides where schedule_id = ${schedule!.id}`).toHaveLength(1)

    await skipFirstBookingSetup(result.user.id)
    await completeFirstBookingSetup(result.user.id, { ...input, event: { ...input.event, title: 'Stale form', slug: 'stale' } })
    expect(await firstBookingSetup(result.user.id)).toMatchObject({ status: 'completed', event: { title: 'Discovery call', slug: 'discovery' } })
  })

  it('does not enrol existing accounts when repairing their starter setup', async () => {
    await auth()
    const [user] = await sql`insert into users (name, username, email) values ('Existing', 'existing', 'existing@example.com') returning id`
    const { ensureAvailabilitySchedule, firstBookingSetup } = await import('@@/server/services/onboarding')
    await ensureAvailabilitySchedule(user!.id, 'UTC')
    expect(await firstBookingSetup(user!.id)).toBeNull()
    expect(await sql`select id from event_types where user_id = ${user!.id}`).toHaveLength(0)
  })

  it('requires a connected video integration before finishing with Zoom', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })
    const { firstBookingSetup, completeFirstBookingSetup } = await import('@@/server/services/onboarding')
    const setup = await firstBookingSetup(result.user.id)
    await expect(completeFirstBookingSetup(result.user.id, {
      event: { ...setup!.event, title: 'Intro', slug: 'intro', locationType: 'zoom' }, schedule: setup!.schedule
    })).rejects.toMatchObject({ statusCode: 409 })
    expect(await firstBookingSetup(result.user.id)).toEqual(setup)
  })

  it('rolls back availability and status if the requested link already exists', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })
    const { firstBookingSetup, completeFirstBookingSetup } = await import('@@/server/services/onboarding')
    const setup = await firstBookingSetup(result.user.id)
    await sql`insert into event_types (user_id, slug, title, duration_minutes) values (${result.user.id}, 'taken', 'Another event', 30)`
    await expect(completeFirstBookingSetup(result.user.id, {
      event: { ...setup!.event, title: 'Intro', slug: 'taken' },
      schedule: { timeZone: 'Europe/London', rules: [{ weekday: 7, start: '12:00', end: '16:00' }] }
    })).rejects.toThrow()
    expect(await firstBookingSetup(result.user.id)).toEqual(setup)
  })

  it('creates only the authenticated user’s event and does not recreate a deleted event on retry', async () => {
    const instance = await auth()
    const result = await instance.api.signUpEmail({ body: credentials })
    const other = await instance.api.signUpEmail({ body: { ...credentials, username: 'other', email: 'other@example.com' } })
    const { firstBookingSetup, completeFirstBookingSetup } = await import('@@/server/services/onboarding')
    const setup = await firstBookingSetup(result.user.id)
    await completeFirstBookingSetup(other.user.id, { event: { ...setup!.event, title: 'Other account', slug: 'other' }, schedule: setup!.schedule })
    expect(await firstBookingSetup(result.user.id)).toEqual(setup)
    await completeFirstBookingSetup(result.user.id, { event: { ...setup!.event, title: 'Intro', slug: 'intro' }, schedule: setup!.schedule })
    await sql`delete from event_types where user_id = ${result.user.id}`
    await expect(completeFirstBookingSetup(result.user.id, setup!)).rejects.toMatchObject({ statusCode: 404 })
    expect(await firstBookingSetup(result.user.id)).toBeNull()
  })

  it('creates exactly one event when completion requests arrive together', async () => {
    const result = await (await auth()).api.signUpEmail({ body: credentials })
    const { firstBookingSetup, completeFirstBookingSetup } = await import('@@/server/services/onboarding')
    const setup = await firstBookingSetup(result.user.id)
    const input = { event: { ...setup!.event, title: 'Intro', slug: 'intro' }, schedule: setup!.schedule }
    await Promise.all([completeFirstBookingSetup(result.user.id, input), completeFirstBookingSetup(result.user.id, input)])
    expect(await sql`select id from event_types where user_id = ${result.user.id}`).toHaveLength(1)
  })

  it('refuses sign-in until the email is confirmed', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })

    await expect(
      instance.api.signInEmail({
        body: { email: credentials.email, password: credentials.password }
      })
    ).rejects.toThrow()
  })

  it('queues a distinct verification email every time an unverified user resends', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    const { resendVerificationEmail } = await import('@@/server/services/verification-email')

    expect(await resendVerificationEmail(
      credentials.email,
      `/verify-email?verified=1&email=${encodeURIComponent(credentials.email)}`
    )).toBe(true)
    expect(await resendVerificationEmail(
      credentials.email,
      `/verify-email?verified=1&email=${encodeURIComponent(credentials.email)}`
    )).toBe(true)

    const rows = await sql<{ dedupe_key: string, action_url: string }[]>`
      select dedupe_key, action_url from email_outbox order by created_at
    `
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map(row => row.dedupe_key)).size).toBe(3)
    expect(rows.slice(1).every(row => row.action_url.includes('/api/auth/verify-email?'))).toBe(true)
  })

  it('does not queue verification email for missing or already verified accounts', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    await confirmEmail(credentials.email)
    const { resendVerificationEmail } = await import('@@/server/services/verification-email')

    expect(await resendVerificationEmail(credentials.email, '/verify-email?verified=1')).toBe(false)
    expect(await resendVerificationEmail('missing@example.com', '/verify-email?verified=1')).toBe(false)

    const rows = await sql`select id from email_outbox`
    expect(rows).toHaveLength(1)
  })

  it('signs in once the email is confirmed', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    await confirmEmail(credentials.email)

    const signedIn = await instance.api.signInEmail({
      body: { email: credentials.email, password: credentials.password }
    })

    expect(signedIn.user.email).toBe(credentials.email)

    const sessions = await sql`select id from sessions`
    expect(sessions.length).toBeGreaterThan(0)
  })

  it('rejects the wrong password', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    await confirmEmail(credentials.email)

    await expect(
      instance.api.signInEmail({
        body: { email: credentials.email, password: 'not-the-password' }
      })
    ).rejects.toThrow()
  })

  it('does not duplicate the user when signing up twice on one email', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    await instance.api.signUpEmail({ body: { ...credentials, username: 'ada2' } })

    const rows = await sql`select id from users where email = ${credentials.email}`
    expect(rows).toHaveLength(1)
  })

  it.each([
    ['slashes that would break the booking URL', 'ada/../admin'],
    ['a reserved word', 'dashboard'],
    ['the onboarding route', 'onboarding'],
    ['far too long', 'a'.repeat(40)],
    ['a leading hyphen', '-ada']
  ])('rejects %s posted straight to the endpoint, bypassing the form', async (_label, username) => {
    const instance = await auth()

    await expect(
      instance.api.signUpEmail({ body: { ...credentials, username } })
    ).rejects.toThrow()

    const rows = await sql`select id from users`
    expect(rows).toHaveLength(0)
  })

  it.each([
    ['an oversized name', { name: 'a'.repeat(81) }],
    ['an invalid time zone', { timeZone: 'Somewhere/Imaginary' }]
  ])('rejects %s posted straight to the endpoint', async (_label, override) => {
    const instance = await auth()

    await expect(
      instance.api.signUpEmail({ body: { ...credentials, ...override } })
    ).rejects.toThrow()

    const rows = await sql`select id from users`
    expect(rows).toHaveLength(0)
  })

  it('accepts passwords up to the shared 200-character limit', async () => {
    const password = 'a'.repeat(200)
    const instance = await auth()

    await instance.api.signUpEmail({ body: { ...credentials, password } })
    await confirmEmail(credentials.email)

    const signedIn = await instance.api.signInEmail({
      body: { email: credentials.email, password }
    })
    expect(signedIn.user.email).toBe(credentials.email)
  })

  it('revokes existing sessions after a password reset', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: credentials })
    await confirmEmail(credentials.email)
    await instance.api.signInEmail({
      body: { email: credentials.email, password: credentials.password }
    })
    await instance.api.signInEmail({
      body: { email: credentials.email, password: credentials.password }
    })

    const sessionsBefore = await sql`select id from sessions`
    expect(sessionsBefore).toHaveLength(2)

    await instance.api.requestPasswordReset({
      body: { email: credentials.email, redirectTo: '/reset-password' }
    })
    const [verification] = await sql<{ identifier: string }[]>`
      select identifier from verifications where identifier like 'reset-password:%'
    `
    const token = verification!.identifier.replace('reset-password:', '')
    const newPassword = 'a-new-long-enough-passphrase'

    await instance.api.resetPassword({ body: { token, newPassword } })

    const sessionsAfter = await sql`select id from sessions`
    expect(sessionsAfter).toHaveLength(0)
    await expect(
      instance.api.signInEmail({
        body: { email: credentials.email, password: credentials.password }
      })
    ).rejects.toThrow()

    const signedIn = await instance.api.signInEmail({
      body: { email: credentials.email, password: newPassword }
    })
    expect(signedIn.user.email).toBe(credentials.email)
  })

  it('derives a valid username when none is supplied', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({
      body: {
        name: 'Ada Lovelace',
        email: 'ada2@example.com',
        password: credentials.password
      } as typeof credentials
    })

    const [row] = await sql<{ username: string }[]>`select username from users`
    expect(row?.username).toBe('ada-lovelace')
  })

  it('sidesteps a username already in use when deriving', async () => {
    const instance = await auth()
    await instance.api.signUpEmail({ body: { ...credentials, username: 'ada-lovelace' } })

    await instance.api.signUpEmail({
      body: {
        name: 'Ada Lovelace',
        email: 'ada2@example.com',
        password: credentials.password
      } as typeof credentials
    })

    const rows = await sql<{ username: string }[]>`select username from users order by created_at`
    expect(rows.map(row => row.username)).toEqual(['ada-lovelace', 'ada-lovelace-2'])
  })
})
