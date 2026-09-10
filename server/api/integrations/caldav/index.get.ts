import { appleCalendarConnection } from '@@/server/integrations/calendar/caldav'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return appleCalendarConnection(session.user.id)
})
