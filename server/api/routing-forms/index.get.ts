import { requireAuthSession } from '@@/server/services/session'
import { listRoutingForms, routingEventOptions } from '@@/server/services/routing-forms'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const owner = { userId: session.user.id } as const
  const [items, eventTypes] = await Promise.all([
    listRoutingForms(owner),
    routingEventOptions(owner)
  ])
  return { items, eventTypes }
})
