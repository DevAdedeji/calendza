import { zoomConnection } from '@@/server/integrations/video/zoom'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return zoomConnection(session.user.id)
})
