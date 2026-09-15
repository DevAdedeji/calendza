import { eq, sql } from 'drizzle-orm'
import { personalBrandingSchema } from '#shared/branding'
import { users } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database'
import { assertPersonalPro } from '@@/server/services/personal-entitlement'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  await assertPersonalPro(session.user.id)
  const parsed = await readValidatedBody(event, personalBrandingSchema.safeParse)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? 'Check those branding settings.'
    })
  }

  const [updated] = await useDatabase().update(users).set({
    brandName: parsed.data.brandName || null,
    brandColor: parsed.data.brandColor,
    brandDarkColor: parsed.data.brandDarkColor,
    bookingPageTheme: parsed.data.bookingPageTheme,
    hideCalendzaBranding: parsed.data.hideCalendzaBranding,
    updatedAt: sql`now()`
  }).where(eq(users.id, session.user.id)).returning({
    brandName: users.brandName,
    logoUrl: users.brandLogoUrl,
    brandColor: users.brandColor,
    brandDarkColor: users.brandDarkColor,
    bookingPageTheme: users.bookingPageTheme,
    hideCalendzaBranding: users.hideCalendzaBranding
  })
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Your profile could not be found.' })
  return { branding: updated }
})
