import { requirePlatformAdminSession } from '@@/server/services/session'
import { operationsOverview } from '@@/server/services/operations'

export default defineEventHandler(async (event) => {
  await requirePlatformAdminSession(event)
  return operationsOverview()
})
