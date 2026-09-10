import { requirePlatformAdminSession } from '@@/server/services/session'
import { operationsDiagnostics } from '@@/server/services/operations'

export default defineEventHandler(async (event) => {
  await requirePlatformAdminSession(event)
  return operationsDiagnostics()
})
