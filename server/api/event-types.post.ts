import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { eventTypeSchema } from '#shared/validation'
import { bookingSetups, eventTypes, schedules } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database/index'
import { ensureAvailabilitySchedule } from '@@/server/services/onboarding'
import { requireLocationIntegration } from '@@/server/services/event-location'
import { requireAuthSession } from '@@/server/services/session'
import { requirePaymentRecipient } from '@@/server/services/paid-booking'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const user = session.user as typeof session.user & { timeZone?: string }
  await ensureAvailabilitySchedule(session.user.id, user.timeZone || 'UTC')
  const parsed = await readValidatedBody(event, eventTypeSchema.safeParse)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? 'Those event details are not valid.'
    })
  }

  const db = useDatabase()
  const { scheduleId: requestedScheduleId, ...input } = parsed.data
  const [schedule] = await db.select({ id: schedules.id }).from(schedules)
    .where(requestedScheduleId
      ? and(eq(schedules.id, requestedScheduleId), eq(schedules.userId, session.user.id))
      : eq(schedules.userId, session.user.id))
    .orderBy(desc(schedules.isDefault), desc(schedules.createdAt))
    .limit(1)
  if (!schedule) {
    throw createError({ statusCode: 409, statusMessage: 'Set your availability before creating an event type.' })
  }
  await requireLocationIntegration(session.user.id, input.locationType)
  await requirePaymentRecipient({ userId: session.user.id }, input.paymentEnabled)

  try {
    const created = await db.transaction(async (tx) => {
      // Coordinate with onboarding so a stale setup cannot create a second first event.
      await tx.select().from(bookingSetups).where(eq(bookingSetups.userId, session.user.id)).for('update')
      const [created] = await tx.insert(eventTypes).values({
        userId: session.user.id,
        scheduleId: schedule.id,
        ...input,
        description: input.description || null,
        incrementMinutes: input.incrementMinutes ?? null,
        bookingWindowDays: input.bookingWindowDays ?? null,
        maxPerDay: input.maxPerDay ?? null,
        maxPerWeek: input.maxPerWeek ?? null,
        maxPerMonth: input.maxPerMonth ?? null
      }).returning({ id: eventTypes.id })
      if (!created) throw new Error('failed to create the event')
      await tx.update(bookingSetups).set({ eventTypeId: created.id, status: 'completed', updatedAt: sql`now()` })
        .where(and(eq(bookingSetups.userId, session.user.id), isNull(bookingSetups.eventTypeId)))
      return created
    })

    setResponseStatus(event, 201)
    return created
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'That booking-link slug is already in use.' })
    }
    throw error
  }
})
