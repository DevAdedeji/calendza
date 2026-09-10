import { paginationQuerySchema } from '#shared/pagination'
import { requireOrganization } from '@@/server/services/organization'
import { listWorkflows } from '@@/server/services/workflows'

export default defineEventHandler(async (event) => {
  const context = await requireOrganization(event, getRouterParam(event, 'slug') ?? '')
  const parsed = await getValidatedQuery(event, paginationQuerySchema.safeParse)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid workflow filters.' })
  return listWorkflows({ organizationId: context.organization.id }, parsed.data.page, parsed.data.pageSize)
})
