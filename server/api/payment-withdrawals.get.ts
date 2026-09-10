import { paymentWithdrawalOptions } from '@@/server/services/payment-withdrawal'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  return paymentWithdrawalOptions({ userId: session.user.id })
})
