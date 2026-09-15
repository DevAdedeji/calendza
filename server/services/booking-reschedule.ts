import { findBookingByUid } from '@@/server/repositories/booking'
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@@/server/database/client'
import { bookingConferenceMeetings, bookings, calendarSyncJobs } from '@@/server/database/schema'

type ConferenceBooking = Pick<typeof bookings.$inferSelect, 'id' | 'hostId' | 'locationType' | 'groupSessionId' | 'status'>

export async function requireZoomRescheduleReady(previous: ConferenceBooking, tx: Pick<Database, 'select'>) {
  if (previous.locationType !== 'zoom' || previous.groupSessionId) return

  // Keep the worker from claiming this booking until the reschedule commits.
  // Read attempts before enqueueCalendarSync resets retry state.
  const [job] = await tx.select({ status: calendarSyncJobs.status, attempts: calendarSyncJobs.attempts })
    .from(calendarSyncJobs).where(eq(calendarSyncJobs.bookingId, previous.id)).for('update')
  if (job?.status === 'processing') {
    throw createError({ statusCode: 409, statusMessage: 'Your meeting is still synchronizing. Please try moving it again shortly.' })
  }
  if (job && job.attempts > 0) {
    const [mapping] = await tx.select({ id: bookingConferenceMeetings.id }).from(bookingConferenceMeetings)
      .where(and(eq(bookingConferenceMeetings.bookingId, previous.id), eq(bookingConferenceMeetings.provider, 'zoom')))
    // A timed-out create may have succeeded remotely. Recover its mapping
    // before replacing the booking UID used to find that remote meeting.
    if (!mapping) {
      throw createError({ statusCode: 409, statusMessage: 'Your Zoom meeting needs to finish synchronizing before it can be moved. Please retry shortly, or ask the host to retry the failed calendar sync.' })
    }
  }
}

export async function transferRescheduledZoomMeeting(
  previous: ConferenceBooking,
  next: ConferenceBooking,
  tx: Pick<Database, 'select' | 'update'>
) {
  // Group meetings belong to the session, and another organizer or a new
  // unpaid reservation must not inherit the original host's live meeting.
  if (previous.locationType !== 'zoom' || next.locationType !== 'zoom'
    || previous.hostId !== next.hostId || previous.groupSessionId || next.groupSessionId
    || next.status === 'awaiting_payment') return

  const [mapping] = await tx.update(bookingConferenceMeetings)
    .set({ bookingId: next.id, updatedAt: sql`now()` })
    .where(and(
      eq(bookingConferenceMeetings.bookingId, previous.id),
      eq(bookingConferenceMeetings.userId, next.hostId),
      eq(bookingConferenceMeetings.provider, 'zoom')
    )).returning({ joinUrl: bookingConferenceMeetings.joinUrl })
  if (mapping) {
    await tx.update(bookings).set({ meetingUrl: mapping.joinUrl, updatedAt: sql`now()` })
      .where(eq(bookings.id, next.id))
  }
}

/** A booking UID is a management capability, never an arbitrary exclusion ID. */
export async function bookingToReschedule(uid: string | undefined, eventTypeId: string, attendeeEmail?: string) {
  if (!uid) return null
  const booking = await findBookingByUid(uid)
  if (!booking || booking.eventTypeId !== eventTypeId) {
    throw createError({ statusCode: 404, statusMessage: 'No such booking to move' })
  }
  if (!['pending', 'confirmed'].includes(booking.status) || booking.endsAt <= new Date()) {
    throw createError({ statusCode: 409, statusMessage: 'That booking can no longer be moved.' })
  }
  if (attendeeEmail && booking.attendeeEmail.toLowerCase() !== attendeeEmail.toLowerCase()) {
    throw createError({ statusCode: 409, statusMessage: 'Use the email address already attached to this booking.' })
  }
  return booking
}
