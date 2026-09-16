import { requireOrganization } from '@@/server/services/organization'
import { listRoutingForms, routingEventOptions } from '@@/server/services/routing-forms'
import { paginationQuerySchema } from '#shared/pagination'

export default defineEventHandler(async (event) => {
  const context = await requireOrganization(event, getRouterParam(event, 'slug') ?? '')
  const parsed = await getValidatedQuery(event, paginationQuerySchema.safeParse)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid routing form pagination.' })
  const owner = { organizationId: context.organization.id } as const
  const [forms, eventTypes] = await Promise.all([
    listRoutingForms(owner, parsed.data.page, parsed.data.pageSize), routingEventOptions(owner)
  ])
  return { ...forms, eventTypes }
})
