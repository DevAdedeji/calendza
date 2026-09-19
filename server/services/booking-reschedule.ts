import { findBookingByUid } from '@@/server/repositories/booking'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Database } from '@@/server/database/client'
import { bookingConferenceMeetings, bookings, calendarSyncJobs, groupEventSessions } from '@@/server/database/schema'
import { canonicalBookingId } from '@@/server/services/group-events'

type ConferenceBooking = Pick<typeof bookings.$inferSelect, 'id' | 'hostId' | 'locationType' | 'groupSessionId' | 'status'>

export async function requireZoomRescheduleReady(previous: ConferenceBooking, tx: Pick<Database, 'select'>) {
  if (previous.locationType !== 'zoom') return

  // Seat claims lock this same row. Keep the source occupancy stable until
  // the transfer commits, including bookings whose canonical seat was cancelled.
  if (previous.groupSessionId) {
    await tx.select({ id: groupEventSessions.id }).from(groupEventSessions)
      .where(eq(groupEventSessions.id, previous.groupSessionId)).for('update')
  }
  await requireZoomSyncReady(await canonicalBookingId(previous.id, tx), tx)
}

async function requireZoomSyncReady(bookingId: string, tx: Pick<Database, 'select'>) {
  // Keep the worker from claiming this booking until the reschedule commits.
  // Read attempts before enqueueCalendarSync resets retry state.
  const [job] = await tx.select({ status: calendarSyncJobs.status, attempts: calendarSyncJobs.attempts, action: calendarSyncJobs.action })
    .from(calendarSyncJobs).where(eq(calendarSyncJobs.bookingId, bookingId)).for('update')
  if (job?.status === 'processing') {
    throw createError({ statusCode: 409, statusMessage: 'Your meeting is still synchronizing. Please try moving it again shortly.' })
  }
  if (job && job.attempts > 0 && job.action === 'upsert') {
    const [mapping] = await tx.select({ id: bookingConferenceMeetings.id }).from(bookingConferenceMeetings)
      .where(and(eq(bookingConferenceMeetings.bookingId, bookingId), eq(bookingConferenceMeetings.provider, 'zoom')))
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
  // Another organizer or a new unpaid reservation cannot inherit this meeting.
  if (previous.locationType !== 'zoom' || next.locationType !== 'zoom'
    || previous.hostId !== next.hostId
    || next.status === 'awaiting_payment') return

  // A group meeting can move only if no other reservation depends on either
  // session. Pending approvals and unpaid holds count, not just confirmed seats.
  for (const booking of [previous, next]) {
    if (!booking.groupSessionId) continue
    const [otherSeat] = await tx.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.groupSessionId, booking.groupSessionId),
      ne(bookings.id, next.id),
      inArray(bookings.status, ['awaiting_payment', 'pending', 'confirmed'])
    )).limit(1)
    if (otherSeat) return
  }

  const sourceId = await canonicalBookingId(previous.id, tx)
  const destinationId = await canonicalBookingId(next.id, tx)
  if (sourceId === destinationId) return
  await requireZoomSyncReady(destinationId, tx)
  const [destinationMeeting] = await tx.select({ id: bookingConferenceMeetings.id }).from(bookingConferenceMeetings)
    .where(and(eq(bookingConferenceMeetings.bookingId, destinationId), eq(bookingConferenceMeetings.provider, 'zoom')))
  if (destinationMeeting) return

  const [mapping] = await tx.update(bookingConferenceMeetings)
    .set({ bookingId: destinationId, updatedAt: sql`now()` })
    .where(and(
      eq(bookingConferenceMeetings.bookingId, sourceId),
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
