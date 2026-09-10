import { createPaymentOnboarding } from '@@/server/services/payment-recipient'
import { enforceRateLimit } from '@@/server/services/rate-limit'
import { requireAuthSession } from '@@/server/services/session'
import { recordSecurityAudit } from '@@/server/services/security-audit'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, { namespace: 'payment-onboarding', limit: 3, windowSeconds: 600 })
  const session = await requireAuthSession(event)
  const onboarding = await createPaymentOnboarding({
    owner: { userId: session.user.id },
    email: session.user.email,
    name: session.user.name,
    returnPath: '/payments'
  })
  await recordSecurityAudit({
    action: 'payments.onboarding_link_created',
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    targetType: 'payment_recipient',
    targetId: session.user.id,
    metadata: { ownerType: 'user' }
  }, event)
  return onboarding
})
