import { storedPersonalBranding } from '@@/server/services/personal-branding'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return storedPersonalBranding(session.user.id)
})
