import { paymentWithdrawalOptions } from '@@/server/services/payment-withdrawal'
import { requireOrganizationPermission } from '@@/server/services/organization'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const context = await requireOrganizationPermission(event, slug, { billing: ['manage'] })
  return paymentWithdrawalOptions({ organizationId: context.organization.id })
})
