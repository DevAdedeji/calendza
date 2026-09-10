import { listAwayPeriods } from '@@/server/services/away-periods'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return listAwayPeriods(session.user.id)
})
