import { microsoftCalendarConnection } from '@@/server/integrations/calendar/microsoft'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return microsoftCalendarConnection(session.user.id)
})
