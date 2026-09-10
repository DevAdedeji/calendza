import { requireOrganizationPermission } from '@@/server/services/organization'
import { paymentSummary } from '@@/server/services/payment-summary'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const context = await requireOrganizationPermission(event, slug, { billing: ['manage'] })
  return paymentSummary({ organizationId: context.organization.id })
})
