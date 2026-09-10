import { cancelPersonalPlan } from '@@/server/services/personal-billing'
import { enforceRateLimit } from '@@/server/services/rate-limit'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  await enforceRateLimit(event, {
    namespace: 'personal-billing-cancel',
    identity: session.user.id,
    limit: 5,
    windowSeconds: 300
  })
  return cancelPersonalPlan(session.user.id)
})
