import { googleCalendarConnection } from '@@/server/integrations/calendar/google'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return googleCalendarConnection(session.user.id)
})
