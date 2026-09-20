import { requireAuthSession } from '@@/server/services/session'
import { paymentDisplayRates } from '@@/server/services/payment-display-rates'

export default defineEventHandler(async (event) => {
  await requireAuthSession(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return paymentDisplayRates(['USD', 'NGN'])
})
