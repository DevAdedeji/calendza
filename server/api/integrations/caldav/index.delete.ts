import { disconnectAppleCalendar } from '@@/server/integrations/calendar/caldav'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  await disconnectAppleCalendar(session.user.id)
  setResponseStatus(event, 204)
  return null
})
