import { requireOrganization } from '@@/server/services/organization'
import { storedTeamBranding } from '@@/server/services/team-branding'

export default defineEventHandler(async (event) => {
  const context = await requireOrganization(event, getRouterParam(event, 'slug') ?? '')
  return { branding: await storedTeamBranding(context.organization.id) }
})
