import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { availabilityRules, bookingSetups, eventTypes, schedules, users } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database'
import { eventTypeSchema, type MeetingLocationType } from '#shared/validation'
import type { FirstBookingSetupInput } from '#shared/onboarding'
import { locationIntegrationReady, requireLocationIntegration } from '@@/server/services/event-location'

const WEEKDAYS = [1, 2, 3, 4, 5]

export async function createAccountSetup(userId: string, timeZone: string, beginOnboarding = false) {
  const db = useDatabase()

  await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(schedules)
      .values({ userId, name: 'Working hours', timeZone, isDefault: true })
      .returning({ id: schedules.id })

    if (!schedule) throw new Error('failed to create the default schedule')

    await tx.insert(availabilityRules).values(
      WEEKDAYS.map(weekday => ({
        scheduleId: schedule.id,
        weekday,
        startTime: '09:00:00',
        endTime: '17:00:00'
      }))
    )

    if (beginOnboarding) {
      await tx.insert(bookingSetups).values({ userId })
    }
  })
}

export async function firstBookingSetup(userId: string) {
  const db = useDatabase()
  const [setup] = await db.select({ status: bookingSetups.status, event: eventTypes })
    .from(bookingSetups)
    .leftJoin(eventTypes, and(eq(eventTypes.id, bookingSetups.eventTypeId), eq(eventTypes.userId, userId)))
    .where(eq(bookingSetups.userId, userId)).limit(1)
  if (!setup) return null
  if (setup.event && !setup.event.scheduleId) return null

  const [schedule] = await db.select({ id: schedules.id, timeZone: schedules.timeZone }).from(schedules)
    .where(and(eq(schedules.userId, userId), setup.event?.scheduleId ? eq(schedules.id, setup.event.scheduleId) : undefined))
    .orderBy(desc(schedules.isDefault), asc(schedules.createdAt)).limit(1)
  if (!schedule) return null

  const rules = await db.select({ weekday: availabilityRules.weekday, start: availabilityRules.startTime, end: availabilityRules.endTime })
    .from(availabilityRules).where(eq(availabilityRules.scheduleId, schedule.id))
  const providers = ['google_meet', 'microsoft_teams', 'zoom'] as const
  const ready = await Promise.all(providers.map(provider => locationIntegrationReady(userId, provider)))
  const availableLocations: MeetingLocationType[] = ['custom', 'video_link', 'phone', 'in_person', ...providers.filter((_, index) => ready[index])]

  return {
    status: setup.status,
    event: setup.event
      ? {
          title: setup.event.title,
          slug: setup.event.slug,
          durationMinutes: setup.event.durationMinutes,
          locationType: setup.event.locationType,
          locationDetails: setup.event.locationDetails
        }
      : {
          title: '', slug: '', durationMinutes: 30,
          locationType: 'custom' as const,
          locationDetails: 'I will share the meeting details before the call.'
        },
    schedule: {
      timeZone: schedule.timeZone,
      rules: rules.map(rule => ({ ...rule, start: rule.start.slice(0, 5), end: rule.end.slice(0, 5) }))
    },
    availableLocations
  }
}

export async function skipFirstBookingSetup(userId: string) {
  await useDatabase().update(bookingSetups).set({ status: 'skipped', updatedAt: sql`now()` })
    .where(and(eq(bookingSetups.userId, userId), eq(bookingSetups.status, 'pending')))
}

export async function completeFirstBookingSetup(userId: string, input: FirstBookingSetupInput) {
  await requireLocationIntegration(userId, input.event.locationType)
  return useDatabase().transaction(async (tx) => {
    const [setup] = await tx.select().from(bookingSetups).where(eq(bookingSetups.userId, userId)).for('update')
    if (!setup) throw createError({ statusCode: 404, statusMessage: 'No booking setup to finish. Manage your links from Event types.' })

    const [event] = setup.eventTypeId
      ? await tx.select().from(eventTypes)
          .where(and(eq(eventTypes.id, setup.eventTypeId), eq(eventTypes.userId, userId))).for('update')
      : []
    if (setup.eventTypeId && !event) throw createError({ statusCode: 404, statusMessage: 'Your event is no longer available.' })
    // A repeated submission must not overwrite later edits to a finished link.
    if (setup.status === 'completed' && event) return { slug: event.slug }

    if (event && !event.scheduleId) throw createError({ statusCode: 409, statusMessage: 'Choose an availability schedule in Event types first.' })
    const [schedule] = await tx.select().from(schedules)
      .where(and(eq(schedules.userId, userId), event?.scheduleId ? eq(schedules.id, event.scheduleId) : undefined))
      .orderBy(desc(schedules.isDefault), asc(schedules.createdAt)).limit(1).for('update')
    if (!schedule) throw createError({ statusCode: 409, statusMessage: 'Choose an availability schedule in Event types first.' })

    let eventTypeId = event?.id
    if (event) {
      const parsed = eventTypeSchema.safeParse({ ...event, ...input.event, description: event.description ?? '' })
      if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message })
      await tx.update(eventTypes).set(input.event).where(eq(eventTypes.id, event.id))
    } else {
      const [created] = await tx.insert(eventTypes).values({
        userId, scheduleId: schedule.id, ...input.event,
        minimumNoticeMinutes: 120, bookingWindowDays: 60
      }).returning({ id: eventTypes.id })
      if (!created) throw new Error('failed to create the first event')
      eventTypeId = created.id
    }
    await tx.update(schedules).set({ timeZone: input.schedule.timeZone }).where(eq(schedules.id, schedule.id))
    await tx.delete(availabilityRules).where(eq(availabilityRules.scheduleId, schedule.id))
    await tx.insert(availabilityRules).values(input.schedule.rules.map(rule => ({
      scheduleId: schedule.id, weekday: rule.weekday, startTime: `${rule.start}:00`, endTime: `${rule.end}:00`
    })))
    await tx.update(users).set({ timeZone: input.schedule.timeZone }).where(eq(users.id, userId))
    await tx.update(bookingSetups).set({ eventTypeId, status: 'completed', updatedAt: sql`now()` }).where(eq(bookingSetups.userId, userId))
    return { slug: input.event.slug }
  })
}

/** Repair missing availability without publishing an event on the user's behalf. */
export async function ensureAvailabilitySchedule(userId: string, timeZone: string) {
  const [existing] = await useDatabase()
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, userId))
    .limit(1)

  if (existing) return false

  await createAccountSetup(userId, timeZone)
  return true
}
