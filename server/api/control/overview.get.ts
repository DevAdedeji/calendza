import { requirePlatformAdminSession } from '@@/server/services/session'
import { controlOverview } from '@@/server/services/control'

export default defineEventHandler(async (event) => {
  await requirePlatformAdminSession(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return controlOverview()
})
