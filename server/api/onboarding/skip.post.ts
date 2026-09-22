import { requireAuthSession } from '@@/server/services/session'
import { skipFirstBookingSetup } from '@@/server/services/onboarding'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  await skipFirstBookingSetup(session.user.id)
  return { success: true }
})
