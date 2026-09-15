import { eq } from 'drizzle-orm'
import {
  DEFAULT_PERSONAL_BRANDING,
  type BookingPageTheme,
  type PublicPersonalBranding
} from '#shared/branding'
import { organizations } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database'

export async function storedTeamBranding(organizationId: string): Promise<PublicPersonalBranding> {
  const [row] = await useDatabase().select({
    name: organizations.name,
    logoUrl: organizations.logo,
    brandColor: organizations.brandColor,
    brandDarkColor: organizations.brandDarkColor,
    bookingPageTheme: organizations.bookingPageTheme,
    hideCalendzaBranding: organizations.hideCalendzaBranding
  }).from(organizations).where(eq(organizations.id, organizationId)).limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Team not found.' })
  return {
    brandName: row.name,
    logoUrl: row.logoUrl,
    brandColor: row.brandColor ?? DEFAULT_PERSONAL_BRANDING.brandColor,
    brandDarkColor: row.brandDarkColor ?? DEFAULT_PERSONAL_BRANDING.brandDarkColor,
    bookingPageTheme: row.bookingPageTheme as BookingPageTheme,
    hideCalendzaBranding: row.hideCalendzaBranding
  }
}
