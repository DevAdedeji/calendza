import { enforceRateLimit } from '@@/server/services/rate-limit'
import { publicTeamProfile } from '@@/server/services/team-booking'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, { namespace: 'team-profile', limit: 120, windowSeconds: 60 })
  const slug = getRouterParam(event, 'slug') ?? ''

  const profile = await publicTeamProfile(slug)
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'No such team page' })

  return profile
})
