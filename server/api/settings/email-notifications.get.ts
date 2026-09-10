import { requireAuthSession } from '@@/server/services/session'
import { emailPreferencesForUser } from '@@/server/services/email-notification-preferences'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return emailPreferencesForUser(session.user.id)
})
