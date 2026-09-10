import { workflowInputSchema } from '#shared/workflows'
import { requireOrganizationPermission } from '@@/server/services/organization'
import { createWorkflow } from '@@/server/services/workflows'

export default defineEventHandler(async (event) => {
  const context = await requireOrganizationPermission(event, getRouterParam(event, 'slug') ?? '', { workflow: ['create'] })
  const parsed = await readValidatedBody(event, workflowInputSchema.safeParse)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'That workflow is not valid.' })
  }
  const created = await createWorkflow({ organizationId: context.organization.id }, context.userId, parsed.data)
  setResponseStatus(event, 201)
  return created
})
