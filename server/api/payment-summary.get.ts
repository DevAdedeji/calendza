import { paymentSummary } from '@@/server/services/payment-summary'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return paymentSummary({ userId: session.user.id })
})
