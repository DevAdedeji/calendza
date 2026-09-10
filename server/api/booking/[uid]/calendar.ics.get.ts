import { bookingCalendarFile } from '@@/server/services/icalendar'
import { findBookingByUid } from '@@/server/repositories/booking'
import { useEnv } from '@@/server/config/env'
import { enforceRateLimit } from '@@/server/services/rate-limit'

export default defineEventHandler(async (event) => {
  const uid = getRouterParam(event, 'uid')
  await enforceRateLimit(event, {
    namespace: 'booking-calendar-file',
    identity: uid,
    limit: 60,
    windowSeconds: 600
  })
  if (!uid) throw createError({ statusCode: 400, statusMessage: 'Missing booking' })

  const booking = await findBookingByUid(uid)
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'No such booking' })

  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="schedra-${uid}.ics"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return bookingCalendarFile(booking, useEnv().schedraUrl)
})
