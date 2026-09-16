import { and, desc, eq } from 'drizzle-orm'
import { eventTypeSchema } from '#shared/validation'
import { eventTypes, schedules } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database/index'
import { ensureStarterSetup } from '@@/server/services/onboarding'
import { requireLocationIntegration } from '@@/server/services/event-location'
import { requireAuthSession } from '@@/server/services/session'
import { requirePaymentRecipient } from '@@/server/services/paid-booking'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const user = session.user as typeof session.user & { timeZone?: string }
  await ensureStarterSetup(session.user.id, user.timeZone || 'UTC')
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
    const [created] = await db.insert(eventTypes).values({
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

    setResponseStatus(event, 201)
    return created
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'That booking-link slug is already in use.' })
    }
    throw error
  }
})
