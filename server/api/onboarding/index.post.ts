import { firstBookingSetupSchema } from '#shared/onboarding'
import { requireAuthSession } from '@@/server/services/session'
import { completeFirstBookingSetup } from '@@/server/services/onboarding'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const parsed = await readValidatedBody(event, firstBookingSetupSchema.safeParse)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message })
  try {
    return await completeFirstBookingSetup(session.user.id, parsed.data)
  } catch (error) {
    const failure = error as { code?: string, cause?: { code?: string } }
    if (failure.code === '23505' || failure.cause?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'That booking-link address is already in use. Choose another one.' })
    }
    throw error
  }
})
