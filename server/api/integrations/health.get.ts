import { integrationSyncHealth } from '@@/server/services/integration-health'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return integrationSyncHealth(session.user.id)
})
