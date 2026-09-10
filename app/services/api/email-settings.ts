import type { EmailNotificationPreferences } from '#shared/email-notification-preferences'
import type { BookingEmailTemplateSettings } from '#shared/email-templates'
import type { PublicPersonalBranding } from '#shared/branding'
import type { PersonalPlanEntitlement } from '#shared/billing'
import { resource } from '@/services/api/http'

export const emailNotificationPreferencesApi = {
  endpoint: '/api/settings/email-notifications' as const,
  update: (body: EmailNotificationPreferences) => $fetch<EmailNotificationPreferences>(
    '/api/settings/email-notifications',
    { method: 'PATCH', body }
  )
}

export interface BookingEmailTemplateSettingsResponse {
  settings: BookingEmailTemplateSettings
  branding: PublicPersonalBranding
  entitlement?: PersonalPlanEntitlement
}

export const bookingEmailTemplatesApi = {
  endpoint: '/api/settings/booking-emails' as const,
  update: (body: BookingEmailTemplateSettings) => $fetch<{ settings: BookingEmailTemplateSettings }>(
    '/api/settings/booking-emails',
    { method: 'PATCH', body }
  )
}

export const teamBookingEmailTemplatesApi = {
  endpoint: (slug: string) => resource('/api/teams', slug, '/booking-emails'),
  update: (slug: string, body: BookingEmailTemplateSettings) =>
    $fetch<{ settings: BookingEmailTemplateSettings }>(
      resource('/api/teams', slug, '/booking-emails'),
      { method: 'PATCH', body }
    )
}
