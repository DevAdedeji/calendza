import postgres from 'postgres'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAppTestEnvironment, getTestDatabaseUrl } from '@@/test/helpers/database'

const url = getTestDatabaseUrl()
const requiredScopes = [
  'user:read:user',
  'meeting:write:meeting',
  'meeting:update:meeting',
  'meeting:delete:meeting',
  'meeting:read:list_meetings'
].join(' ')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe.skipIf(!url)('Zoom integration', () => {
  const sql = postgres(url!, { max: 5, onnotice: () => {} })

  async function configure() {
    configureAppTestEnvironment(url!)
    process.env.ZOOM_CLIENT_ID = 'zoom-client-id'
    process.env.ZOOM_CLIENT_SECRET = 'zoom-client-secret'
    process.env.ZOOM_WEBHOOK_SECRET = 'zoom-webhook-secret'
    process.env.INTEGRATION_ENCRYPTION_KEY = 'integration-test-key-that-is-at-least-32-characters'
    const { resetEnv } = await import('@@/server/config/env')
    resetEnv()
  }

  async function createHostAndBooking() {
    const [host] = await sql<{ id: string }[]>`
      insert into users (email, name, username, email_verified, time_zone)
      values ('zoom-host@example.com', 'Zoom Host', 'zoom-host', true, 'Africa/Lagos')
      returning id
    `
    const [schedule] = await sql<{ id: string }[]>`
      insert into schedules (user_id, name, time_zone, is_default)
      values (${host!.id}, 'Working hours', 'Africa/Lagos', true)
      returning id
    `
    const [eventType] = await sql<{ id: string }[]>`
      insert into event_types (
        user_id, schedule_id, slug, title, description, duration_minutes,
        location_type, location_details
      ) values (
        ${host!.id}, ${schedule!.id}, 'zoom-call', 'Zoom call', 'Project review', 30,
        'zoom', ''
      ) returning id
    `
    const [booking] = await sql<{ id: string }[]>`
      insert into bookings (
        event_type_id, host_id, uid, starts_at, ends_at,
        attendee_name, attendee_email, attendee_time_zone,
        location_type, location_details
      ) values (
        ${eventType!.id}, ${host!.id}, 'zoom-booking-uid',
        '2026-09-07T08:00:00Z', '2026-09-07T08:30:00Z',
        'Guest Person', 'guest@example.com', 'Europe/London', 'zoom', ''
      ) returning id
    `
    return { hostId: host!.id, bookingId: booking!.id }
  }

  async function connect(hostId: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      id: 'zoom-account-id',
      email: 'zoom-host@example.com'
    })))
    const { saveZoomConnection } = await import('@@/server/integrations/video/zoom')
    await saveZoomConnection(hostId, {
      access_token: 'plain-access-token',
      refresh_token: 'plain-refresh-token',
      expires_in: 3600,
      scope: requiredScopes
    })
  }

  beforeEach(async () => {
    await configure()
    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
    await sql`
      truncate table
        calendar_sync_jobs, booking_calendar_events, booking_conference_meetings,
        calendar_connections, video_conference_connections,
        email_outbox, api_rate_limits, rate_limits, sessions, accounts,
        verifications, bookings, event_types, date_overrides,
        availability_rules, schedules, users, organizations
      restart identity cascade
    `
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await sql`
      truncate table
        calendar_sync_jobs, booking_calendar_events, booking_conference_meetings,
        calendar_connections, video_conference_connections,
        email_outbox, api_rate_limits, rate_limits, sessions, accounts,
        verifications, bookings, event_types, date_overrides,
        availability_rules, schedules, users, organizations
      restart identity cascade
    `
    await sql.end()
  })

  it('builds a state-bound OAuth request and stores credentials encrypted', async () => {
    const { hostId } = await createHostAndBooking()
    const { zoomAuthorizationUrl, saveZoomConnection, zoomConnection } = await import('@@/server/integrations/video/zoom')
    const authorization = new URL(zoomAuthorizationUrl('safe-state', 'pkce-challenge'))

    expect(authorization.origin).toBe('https://zoom.us')
    expect(authorization.searchParams.get('state')).toBe('safe-state')
    expect(authorization.searchParams.get('code_challenge')).toBe('pkce-challenge')
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorization.searchParams.get('redirect_uri')).toBe('http://localhost:3002/api/integrations/zoom/callback')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      id: 'zoom-account-id',
      email: 'zoom-host@example.com'
    })))
    await saveZoomConnection(hostId, {
      access_token: 'plain-access-token',
      refresh_token: 'plain-refresh-token',
      expires_in: 3600,
      scope: requiredScopes
    })

    const [stored] = await sql<{
      accessToken: string
      refreshToken: string
      accountLabel: string
    }[]>`
      select access_token_encrypted as "accessToken",
             refresh_token_encrypted as "refreshToken",
             account_label as "accountLabel"
      from video_conference_connections where user_id = ${hostId}
    `
    expect(stored?.accessToken).not.toContain('plain-access-token')
    expect(stored?.refreshToken).not.toContain('plain-refresh-token')
    expect(stored?.accountLabel).toBe('zoom-host@example.com')
    await expect(zoomConnection(hostId)).resolves.toMatchObject({ connected: true, configured: true })
  })

  it('requires reconnection when an older token is missing meeting permissions', async () => {
    const { hostId } = await createHostAndBooking()
    await connect(hostId)
    await sql`
      update video_conference_connections
      set scope = 'user:read:user meeting:write:meeting'
      where user_id = ${hostId}
    `

    const { checkZoomConnection, zoomConnection } = await import('@@/server/integrations/video/zoom')
    await expect(zoomConnection(hostId)).resolves.toMatchObject({
      connected: false,
      status: 'needs_reauthorization'
    })
    await expect(checkZoomConnection(hostId)).rejects.toThrow('Reconnect Zoom')
  })

  it('keeps Zoom error codes and messages available for private diagnostics', async () => {
    const { hostId } = await createHostAndBooking()
    await connect(hostId)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      code: 3161,
      message: 'Meeting hosting and scheduling capabilities are not allowed for this user.'
    }, 400)))

    const { upsertZoomMeeting } = await import('@@/server/integrations/video/zoom')
    await expect(upsertZoomMeeting(hostId, null, {
      uid: 'failed-zoom-booking',
      title: 'Zoom call',
      description: null,
      startsAt: new Date('2026-09-07T08:00:00Z'),
      endsAt: new Date('2026-09-07T08:30:00Z'),
      attendeeName: 'Guest Person'
    })).rejects.toThrow('Zoom request failed (400, code 3161): Meeting hosting and scheduling capabilities are not allowed for this user.')
  })

  it('rotates refresh tokens and retries an unauthorized Zoom request once', async () => {
    const { hostId } = await createHostAndBooking()
    await connect(hostId)
    await sql`update video_conference_connections set access_token_expires_at = now() - interval '1 minute' where user_id = ${hostId}`

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = String(input)
      if (requestUrl.startsWith('https://zoom.us/oauth/token')) {
        return json({
          access_token: 'rotated-access-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
          scope: requiredScopes
        })
      }
      if (requestUrl.includes('/users/me/meetings?')) return json({ meetings: [] })
      if (requestUrl.endsWith('/users/me/meetings')) {
        return json({ id: 123456789, join_url: 'https://zoom.us/j/123456789?pwd=safe' }, 201)
      }
      return json({ message: 'unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { upsertZoomMeeting } = await import('@@/server/integrations/video/zoom')
    const remote = await upsertZoomMeeting(hostId, null, {
      uid: 'refresh-token-booking',
      title: 'Zoom call',
      description: null,
      startsAt: new Date('2026-09-07T08:00:00Z'),
      endsAt: new Date('2026-09-07T08:30:00Z'),
      attendeeName: 'Guest Person'
    })

    expect(remote).toEqual({ id: '123456789', joinUrl: 'https://zoom.us/j/123456789?pwd=safe' })
    const [stored] = await sql<{ accessToken: string, refreshToken: string }[]>`
      select access_token_encrypted as "accessToken", refresh_token_encrypted as "refreshToken"
      from video_conference_connections where user_id = ${hostId}
    `
    const { decryptCredential } = await import('@@/server/integrations/calendar/credential-crypto')
    expect(decryptCredential(stored!.accessToken)).toBe('rotated-access-token')
    expect(decryptCredential(stored!.refreshToken)).toBe('rotated-refresh-token')
  })

  it('creates, updates and deletes the same Zoom meeting through durable booking jobs', async () => {
    const { hostId, bookingId } = await createHostAndBooking()
    await connect(hostId)

    const requests: Array<{ url: string, method: string, body: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = { url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') }
      requests.push(request)
      if (request.url.includes('/users/me/meetings?')) return json({ meetings: [] })
      if (request.url.endsWith('/users/me/meetings') && request.method === 'POST') {
        return json({ id: 987654321, join_url: 'https://zoom.us/j/987654321?pwd=safe' }, 201)
      }
      if (request.url.endsWith('/meetings/987654321') && request.method === 'PATCH') return new Response(null, { status: 204 })
      if (request.url.endsWith('/meetings/987654321') && request.method === 'DELETE') return new Response(null, { status: 204 })
      return json({ message: 'unexpected request' }, 500)
    }))

    const { enqueueCalendarSync, processCalendarSyncJobs } = await import('@@/server/services/calendar-sync')
    await enqueueCalendarSync(bookingId, 'upsert')
    expect(await processCalendarSyncJobs()).toBe(1)

    const [created] = await sql<{ meetingUrl: string, meetingId: string }[]>`
      select b.meeting_url as "meetingUrl", m.meeting_id as "meetingId"
      from bookings b inner join booking_conference_meetings m on m.booking_id = b.id
      where b.id = ${bookingId}
    `
    expect(created).toEqual({
      meetingUrl: 'https://zoom.us/j/987654321?pwd=safe',
      meetingId: '987654321'
    })
    const createRequest = requests.find(request => request.method === 'POST' && request.url.endsWith('/users/me/meetings'))
    expect(createRequest?.body).toContain('Project review')
    expect(createRequest?.body).toContain('Guest Person')
    expect(createRequest?.body).not.toContain('guest@example.com')

    await sql`
      update bookings
      set starts_at = '2026-09-07T09:00:00Z', ends_at = '2026-09-07T09:30:00Z'
      where id = ${bookingId}
    `
    await sql`
      update calendar_sync_jobs set status = 'pending', attempts = 0, available_at = now()
      where dedupe_key = ${`booking:${bookingId}`}
    `
    expect(await processCalendarSyncJobs()).toBe(1)
    expect(requests.some(request => request.method === 'PATCH' && request.body.includes('2026-09-07T09:00:00.000Z'))).toBe(true)

    await sql`update bookings set status = 'cancelled' where id = ${bookingId}`
    await enqueueCalendarSync(bookingId, 'delete')
    expect(await processCalendarSyncJobs()).toBe(1)
    expect(requests.some(request => request.method === 'DELETE' && request.url.endsWith('/meetings/987654321'))).toBe(true)
    expect(await sql`select id from booking_conference_meetings where booking_id = ${bookingId}`).toHaveLength(0)
  })

  async function rescheduleFixture(initialSync: 'complete' | 'pending' | 'failed' = 'complete') {
    const fixture = await createHostAndBooking()
    await sql`update bookings set starts_at = '2030-09-09T09:00Z', ends_at = '2030-09-09T09:30Z' where id = ${fixture.bookingId}`
    await sql`update schedules set time_zone = 'UTC' where user_id = ${fixture.hostId}`
    await sql`insert into availability_rules (schedule_id, weekday, start_time, end_time)
      select id, day, '09:00'::time, '17:00'::time from schedules cross join generate_series(1, 7) day
      where user_id = ${fixture.hostId}`
    await sql`update event_types set minimum_notice_minutes = 0, booking_window_days = null where user_id = ${fixture.hostId}`
    await connect(fixture.hostId)
    const requests: Array<{ url: string, method: string, body: string }> = []
    let patchFailure = 0
    let recoveredInitialCreate = false
    let beforePatch: (() => Promise<void>) | undefined
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = { url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') }
      requests.push(request)
      if (request.url.includes('/users/me/meetings?')) return json({ meetings: recoveredInitialCreate
        ? [{ id: 987654321, join_url: 'https://zoom.us/j/987654321?pwd=safe', agenda: '[Schedra:zoom-booking-uid]' }]
        : [] })
      if (request.url.endsWith('/users/me/meetings') && request.method === 'POST') {
        if (initialSync === 'failed') throw new TypeError('The connection closed before the create response arrived.')
        const id = 987654320 + requests.filter(item => item.method === 'POST').length
        return json({ id, join_url: `https://zoom.us/j/${id}?pwd=safe` }, 201)
      }
      if (request.method === 'PATCH') {
        await beforePatch?.()
        return patchFailure ? json({ message: 'Temporary provider failure' }, patchFailure) : new Response(null, { status: 204 })
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      return json({ message: 'unexpected request' }, 500)
    }))
    const { enqueueCalendarSync, processCalendarSyncJobs } = await import('@@/server/services/calendar-sync')
    await enqueueCalendarSync(fixture.bookingId, 'upsert')
    if (initialSync !== 'pending') await processCalendarSyncJobs()
    const { createPersonalBooking } = await import('@@/server/services/personal-booking-creation')
    const move = (uid = 'zoom-booking-uid', start = '2030-09-09T12:00:00Z') => createPersonalBooking({
      username: 'zoom-host', slug: 'zoom-call', start, name: 'Guest Person', email: 'guest@example.com',
      timeZone: 'UTC', source: 'hosted', rescheduleOf: uid
    })
    return {
      ...fixture, requests, move, enqueueCalendarSync, processCalendarSyncJobs,
      failPatch: (status: number) => { patchFailure = status },
      recoverInitialCreate: () => { recoveredInitialCreate = true },
      pausePatch: (pause: () => Promise<void>) => { beforePatch = pause }
    }
  }

  it('keeps the Zoom ID and join link through real personal reschedules, including consecutive unsynced moves', async () => {
    const fixture = await rescheduleFixture()
    const first = await fixture.move()
    const second = await fixture.move(first.uid, '2030-09-09T14:00:00Z')
    expect(await fixture.processCalendarSyncJobs()).toBe(3)
    const [mapping] = await sql`select m.meeting_id, m.join_url, b.uid from booking_conference_meetings m join bookings b on b.id = m.booking_id`
    expect(mapping).toMatchObject({ meeting_id: '987654321', join_url: 'https://zoom.us/j/987654321?pwd=safe', uid: second.uid })
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    const patches = fixture.requests.filter(request => request.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0]!.url).toContain('/meetings/987654321')
    expect(JSON.parse(patches[0]!.body)).toMatchObject({ start_time: '2030-09-09T14:00:00.000Z', duration: 30 })
    const [current] = await sql`update bookings set status = 'cancelled' where uid = ${second.uid} returning id`
    await fixture.enqueueCalendarSync(current!.id, 'delete')
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toEqual([
      expect.objectContaining({ url: 'https://api.zoom.us/v2/meetings/987654321' })
    ])
    expect(await sql`select id from booking_conference_meetings`).toHaveLength(0)
  })

  it('retries a failed update against the same Zoom ID without creating a replacement', async () => {
    const fixture = await rescheduleFixture()
    await fixture.move()
    fixture.failPatch(503)
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    expect(await sql`select id from calendar_sync_jobs where status = 'pending'`).toHaveLength(1)
    fixture.failPatch(0)
    await sql`update calendar_sync_jobs set available_at = now() where status = 'pending'`
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'PATCH').map(request => request.url))
      .toEqual(['https://api.zoom.us/v2/meetings/987654321', 'https://api.zoom.us/v2/meetings/987654321'])
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
  })

  it('rolls a reschedule back while a Zoom worker is in flight, then allows retry safely', async () => {
    const fixture = await rescheduleFixture()
    let release!: () => void
    let entered!: () => void
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    fixture.pausePatch(async () => {
      entered()
      await waiting
    })
    await fixture.enqueueCalendarSync(fixture.bookingId, 'upsert')
    const running = fixture.processCalendarSyncJobs()
    await started
    try {
      await expect(fixture.move()).rejects.toMatchObject({ statusCode: 409 })
      expect((await sql`select status from bookings where id = ${fixture.bookingId}`)[0]!.status).toBe('confirmed')
      expect(await sql`select id from bookings`).toHaveLength(1)
    } finally {
      release()
      await running
    }
    await fixture.move()
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
  })

  it('retains the Zoom ID while a reschedule awaits approval and updates it after approval', async () => {
    const fixture = await rescheduleFixture()
    await sql`update event_types set requires_confirmation = true where user_id = ${fixture.hostId}`
    const moved = await fixture.move()
    expect(moved.status).toBe('pending')
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => ['PATCH', 'DELETE'].includes(request.method))).toHaveLength(0)
    const [approved] = await sql`update bookings set status = 'confirmed' where uid = ${moved.uid} returning id`
    await fixture.enqueueCalendarSync(approved!.id, 'upsert')
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'PATCH')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
  })

  it('keeps the Zoom ID through the real team booking reschedule flow', async () => {
    const fixture = await rescheduleFixture()
    const [team] = await sql`insert into organizations (name, slug) values ('Zoom team', 'zoom-team') returning id`
    await sql`insert into organization_subscriptions (organization_id, status) values (${team!.id}, 'active')`
    const [member] = await sql`insert into members (organization_id, user_id, role) values (${team!.id}, ${fixture.hostId}, 'owner') returning id`
    const [event] = await sql`update event_types set user_id = null, organization_id = ${team!.id}, created_by_user_id = ${fixture.hostId},
      assignment_mode = 'collective' where user_id = ${fixture.hostId} returning id`
    await sql`insert into event_type_hosts (event_type_id, member_id, user_id) values (${event!.id}, ${member!.id}, ${fixture.hostId})`
    await sql`update bookings set organization_id = ${team!.id} where id = ${fixture.bookingId}`
    const { createTeamBooking } = await import('@@/server/services/team-booking-creation')
    const moved = await createTeamBooking({
      team: 'zoom-team', slug: 'zoom-call', start: '2030-09-09T12:00:00Z', name: 'Guest Person', email: 'guest@example.com',
      timeZone: 'UTC', source: 'hosted', rescheduleOf: 'zoom-booking-uid'
    })
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    expect((await sql`select m.meeting_id, b.uid from booking_conference_meetings m join bookings b on b.id = m.booking_id`)[0])
      .toMatchObject({ meeting_id: '987654321', uid: moved.uid })
  })

  it('does not move another guest\'s shared Zoom meeting when one group seat is rescheduled', async () => {
    const fixture = await rescheduleFixture()
    const [event] = await sql`update event_types set capacity = 3 where user_id = ${fixture.hostId} returning id`
    const [group] = await sql`insert into group_event_sessions (event_type_id, starts_at, ends_at, capacity)
      values (${event!.id}, '2030-09-09T09:00Z', '2030-09-09T09:30Z', 3) returning id`
    await sql`update bookings set group_session_id = ${group!.id} where id = ${fixture.bookingId}`
    await sql`update booking_hosts set group_session_id = ${group!.id} where booking_id = ${fixture.bookingId}`
    await sql`insert into bookings (event_type_id, host_id, uid, starts_at, ends_at, attendee_name, attendee_email,
      attendee_time_zone, location_type, location_details, group_session_id)
      values (${event!.id}, ${fixture.hostId}, 'other-group-guest', '2030-09-09T09:00Z', '2030-09-09T09:30Z',
      'Other Guest', 'other@example.com', 'UTC', 'zoom', '', ${group!.id})`
    const moved = await fixture.move()
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(2)
    expect((await sql`select meeting_id from booking_conference_meetings where booking_id = ${fixture.bookingId}`)[0]!.meeting_id)
      .toBe('987654321')
    expect((await sql`select m.meeting_id from booking_conference_meetings m join bookings b on b.id = m.booking_id where b.uid = ${moved.uid}`)[0]!.meeting_id)
      .toBe('987654322')
  })

  it('updates a recovered remote meeting before reusing its ID after a missing local mapping', async () => {
    const fixture = await rescheduleFixture()
    const requests: Array<{ method: string, body: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push({ method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      if (init?.method === 'PATCH') return new Response(null, { status: 204 })
      return json({ meetings: [{ id: 987654321, join_url: 'https://zoom.us/j/987654321', agenda: '[Schedra:recovered-booking]' }] })
    }))
    const { upsertZoomMeeting } = await import('@@/server/integrations/video/zoom')
    await expect(upsertZoomMeeting(fixture.hostId, null, {
      uid: 'recovered-booking', title: 'Recovered', description: null, attendeeName: 'Guest',
      startsAt: new Date('2030-09-09T13:00Z'), endsAt: new Date('2030-09-09T14:00Z')
    })).resolves.toEqual({ id: '987654321', joinUrl: 'https://zoom.us/j/987654321' })
    expect(requests.map(request => request.method)).toEqual(['GET', 'PATCH'])
    expect(JSON.parse(requests[1]!.body)).toMatchObject({ start_time: '2030-09-09T13:00:00.000Z', duration: 60 })
  })

  it('does not replace a meeting when Zoom denies the update permission', async () => {
    const fixture = await rescheduleFixture()
    await fixture.move()
    fixture.failPatch(403)
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    expect(await sql`select id from calendar_sync_jobs where status = 'failed'`).toHaveLength(1)
    expect((await sql`select meeting_id from booking_conference_meetings`)[0]!.meeting_id).toBe('987654321')
  })

  it('waits for an ambiguous initial create to recover before rescheduling its meeting', async () => {
    const fixture = await rescheduleFixture('failed')
    await expect(fixture.move()).rejects.toMatchObject({ statusCode: 409 })
    expect(await sql`select id from bookings`).toHaveLength(1)
    expect((await sql`select status from bookings where id = ${fixture.bookingId}`)[0]!.status).toBe('confirmed')
    expect((await sql`select attempts from calendar_sync_jobs where booking_id = ${fixture.bookingId}`)[0]!.attempts).toBe(1)
    fixture.recoverInitialCreate()
    await sql`update calendar_sync_jobs set available_at = now() where booking_id = ${fixture.bookingId}`
    await fixture.processCalendarSyncJobs()
    await fixture.move()
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
    expect((await sql`select meeting_id from booking_conference_meetings`)[0]!.meeting_id).toBe('987654321')
  })

  it('allows rescheduling a clean queued booking before any Zoom create was attempted', async () => {
    const fixture = await rescheduleFixture('pending')
    await fixture.move()
    await fixture.processCalendarSyncJobs()
    expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1)
    expect(fixture.requests.filter(request => request.method === 'DELETE')).toHaveLength(0)
  })

  it('deauthorization removes credentials and locally held Zoom meeting data', async () => {
    const { hostId, bookingId } = await createHostAndBooking()
    await connect(hostId)
    const [connection] = await sql<{ id: string }[]>`
      select id from video_conference_connections where user_id = ${hostId}
    `
    await sql`
      update bookings
      set meeting_url = 'https://zoom.us/j/123456789?pwd=private'
      where id = ${bookingId}
    `
    await sql`
      insert into booking_conference_meetings (
        booking_id, user_id, connection_id, provider, meeting_id, join_url
      ) values (
        ${bookingId}, ${hostId}, ${connection!.id}, 'zoom', '123456789',
        'https://zoom.us/j/123456789?pwd=private'
      )
    `

    const { deauthorizeZoomUser } = await import('@@/server/services/zoom-connection')
    await expect(deauthorizeZoomUser('zoom-account-id')).resolves.toEqual({
      removedConnections: 1,
      removedMeetings: 1
    })

    const [booking] = await sql<{ meetingUrl: string | null }[]>`
      select meeting_url as "meetingUrl" from bookings where id = ${bookingId}
    `
    expect(booking?.meetingUrl).toBeNull()
    expect(await sql`select id from booking_conference_meetings where booking_id = ${bookingId}`).toHaveLength(0)
    expect(await sql`select id from video_conference_connections where user_id = ${hostId}`).toHaveLength(0)

    await expect(deauthorizeZoomUser('zoom-account-id')).resolves.toEqual({
      removedConnections: 0,
      removedMeetings: 0
    })
  })
})
