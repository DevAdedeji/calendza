import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { configureAppTestEnvironment, getTestDatabaseUrl } from '@@/test/helpers/database'

const url = getTestDatabaseUrl()

describe.skipIf(!url)('profile persistence', () => {
  const sql = postgres(url!, { max: 2, onnotice: () => {} })

  beforeEach(async () => {
    configureAppTestEnvironment(url!)
    await sql`
      truncate table email_outbox, api_rate_limits, rate_limits, sessions,
        accounts, verifications, bookings, event_types, date_overrides,
        availability_rules, schedules, users, organizations
      restart identity cascade
    `
  })

  afterAll(async () => {
    await sql.end()
  })

  it('owns audit timestamps in PostgreSQL', async () => {
    const [created] = await sql<{ id: string, createdAt: Date, updatedAt: Date }[]>`
      insert into users (email, name, username, time_zone)
      values ('database-clock@example.com', 'Database Clock', 'database-clock', 'UTC')
      returning id, created_at as "createdAt", updated_at as "updatedAt"
    `
    expect(created!.createdAt.getTime()).toBe(created!.updatedAt.getTime())

    await sql`select pg_sleep(0.01)`
    await sql`update users set name = 'Database Clock Updated' where id = ${created!.id}`

    const [updated] = await sql<{ createdAt: Date, updatedAt: Date }[]>`
      select created_at as "createdAt", updated_at as "updatedAt"
      from users
      where id = ${created!.id}
    `
    expect(updated!.createdAt.getTime()).toBe(created!.createdAt.getTime())
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(created!.updatedAt.getTime())
  })

  it('reads editable fields from the database instead of a cached session snapshot', async () => {
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, username, bio, time_zone)
      values ('profile@example.com', 'Original Name', 'profile', null, 'Africa/Lagos')
      returning id
    `
    const { profileForUser } = await import('@@/server/repositories/profile')

    await sql`
      update users
      set name = 'Updated Name', bio = 'A bio that must survive a refresh.'
      where id = ${user!.id}
    `

    await expect(profileForUser(user!.id)).resolves.toMatchObject({
      name: 'Updated Name',
      bio: 'A bio that must survive a refresh.',
      timeZone: 'Africa/Lagos'
    })
  })

  it('reports whether an account has a password credential', async () => {
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, username, time_zone)
      values ('google-only@example.com', 'Google Only', 'google-only', 'UTC')
      returning id
    `
    await sql`
      insert into accounts (user_id, account_id, provider_id)
      values (${user!.id}, 'google-account', 'google')
    `
    const { profileForUser } = await import('@@/server/repositories/profile')

    await expect(profileForUser(user!.id)).resolves.toMatchObject({ hasPassword: false })

    await sql`
      insert into accounts (user_id, account_id, provider_id, password)
      values (${user!.id}, 'credential-account', 'credential', 'hashed-password')
    `
    await expect(profileForUser(user!.id)).resolves.toMatchObject({ hasPassword: true })
  })

  it('persists currency per account without changing event prices or other profile fields', async () => {
    const [owner, other] = await sql<{ id: string }[]>`
      insert into users (email, name, username, time_zone)
      values ('currency@example.com', 'Currency Owner', 'currency-owner', 'Africa/Lagos'),
        ('other-currency@example.com', 'Other Owner', 'other-currency', 'UTC')
      returning id
    `
    await sql`insert into event_types (user_id, title, slug, duration_minutes, location_type, price_cents, payment_currency, payment_enabled)
      values (${owner!.id}, 'Existing paid call', 'paid-call', 30, 'custom', 2500, 'USD', true)`
    const { profileForUser, updatePreferredCurrency } = await import('@@/server/repositories/profile')
    expect((await profileForUser(owner!.id))?.preferredCurrency).toBeNull()
    await expect(updatePreferredCurrency(owner!.id, 'NGN')).resolves.toEqual({ preferredCurrency: 'NGN' })
    expect(await profileForUser(owner!.id)).toMatchObject({ preferredCurrency: 'NGN', name: 'Currency Owner', timeZone: 'Africa/Lagos' })
    expect((await profileForUser(other!.id))?.preferredCurrency).toBeNull()
    const [event] = await sql`select price_cents, payment_currency from event_types where user_id = ${owner!.id}`
    expect(event).toMatchObject({ price_cents: 2500, payment_currency: 'USD' })
    await updatePreferredCurrency(owner!.id, 'USD')
    expect((await profileForUser(owner!.id))?.preferredCurrency).toBe('USD')
    await expect(sql`update users set preferred_currency = 'EUR' where id = ${owner!.id}`).rejects.toMatchObject({ code: '23514' })
  })

  it('stores verified avatar bytes and removes them with the owning account', async () => {
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, username, time_zone)
      values ('avatar@example.com', 'Avatar User', 'avatar-user', 'Africa/Lagos')
      returning id
    `
    const { eq } = await import('drizzle-orm')
    const { userAvatars, users } = await import('@@/server/database/schema')
    const { useDatabase } = await import('@@/server/database/index')
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

    await useDatabase().insert(userAvatars).values({
      userId: user!.id,
      contentType: 'image/png',
      bytes,
      size: bytes.length,
      hash: 'test-hash'
    })
    const [stored] = await useDatabase().select().from(userAvatars).where(eq(userAvatars.userId, user!.id))
    expect(Buffer.from(stored!.bytes)).toEqual(bytes)

    await useDatabase().delete(users).where(eq(users.id, user!.id))
    const remaining = await useDatabase().select().from(userAvatars).where(eq(userAvatars.userId, user!.id))
    expect(remaining).toEqual([])
  })
})
