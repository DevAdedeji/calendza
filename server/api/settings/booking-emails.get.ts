import { personalBookingEmailTemplateSettings } from '@@/server/services/booking-email-template-settings'
import { storedPersonalBranding } from '@@/server/services/personal-branding'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const [settings, stored] = await Promise.all([
    personalBookingEmailTemplateSettings(session.user.id),
    storedPersonalBranding(session.user.id)
  ])
  return { settings, branding: stored.branding, entitlement: stored.entitlement }
})
