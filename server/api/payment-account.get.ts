import { findPaymentRecipient, publicRecipient, syncPaymentRecipient, unavailableRecipient } from '@@/server/services/payment-recipient'
import { requireAuthSession } from '@@/server/services/session'
import { personalPaidBookingFeeBps } from '@@/server/services/personal-entitlement'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const row = await findPaymentRecipient({ userId: session.user.id })
  const account = !row?.bachsAccountId
    ? publicRecipient(row)
    : await syncPaymentRecipient(row).then(publicRecipient).catch(() => unavailableRecipient(row))
  return { ...account, platformFeeBps: await personalPaidBookingFeeBps(session.user.id) }
})
