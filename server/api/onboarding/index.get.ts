import { requireAuthSession } from '@@/server/services/session'
import { firstBookingSetup } from '@@/server/services/onboarding'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return firstBookingSetup(session.user.id)
})
