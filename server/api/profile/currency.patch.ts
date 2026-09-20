import { z } from 'zod'
import { paymentCurrencySchema } from '#shared/payments'
import { requireAuthSession } from '@@/server/services/session'
import { updatePreferredCurrency } from '@@/server/repositories/profile'

const schema = z.object({ preferredCurrency: paymentCurrencySchema }).strict()

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const parsed = await readValidatedBody(event, schema.safeParse)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Choose NGN or USD.' })
  }
  const updated = await updatePreferredCurrency(session.user.id, parsed.data.preferredCurrency)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Your profile could not be found.' })
  return updated
})
