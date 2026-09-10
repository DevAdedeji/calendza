import { randomBytes } from 'node:crypto'
import { googleAuthorizationUrl } from '@@/server/integrations/calendar/google'
import { useEnv } from '@@/server/config/env'
import { requireAuthSession } from '@@/server/services/session'
import { createOAuthPkce } from '@@/server/security/oauth'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const state = randomBytes(32).toString('base64url')
  const pkce = createOAuthPkce()

  const cookieOptions = {
    httpOnly: true,
    secure: new URL(useEnv().schedraUrl).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/api/integrations/google-calendar',
    maxAge: 10 * 60
  }

  setCookie(event, 'schedra_google_calendar_state', state, {
    ...cookieOptions
  })
  setCookie(event, 'schedra_google_calendar_pkce', pkce.verifier, cookieOptions)

  return sendRedirect(event, googleAuthorizationUrl(state, session.user.email, pkce.challenge))
})
