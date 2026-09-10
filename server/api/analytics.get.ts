import { analyticsQuerySchema } from '#shared/analytics'
import { getBookingAnalytics } from '@@/server/services/analytics'
import { requireAuthSession } from '@@/server/services/session'
import { personalPlanEntitlement } from '@@/server/services/personal-entitlement'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const parsed = await getValidatedQuery(event, analyticsQuerySchema.safeParse)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose a valid analytics range.' })
  const entitlement = await personalPlanEntitlement(session.user.id)
  return getBookingAnalytics(
    { userId: session.user.id },
    parsed.data,
    { includeRevenue: entitlement.isPro }
  )
})
