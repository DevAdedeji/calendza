import { paginationQuerySchema } from '#shared/pagination'
import { requireAuthSession } from '@@/server/services/session'
import { listWorkflows } from '@@/server/services/workflows'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const parsed = await getValidatedQuery(event, paginationQuerySchema.safeParse)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid workflow filters.' })
  return listWorkflows({ userId: session.user.id }, parsed.data.page, parsed.data.pageSize)
})
