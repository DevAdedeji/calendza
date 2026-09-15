import { randomBytes } from 'node:crypto'
import { zoomAuthorizationUrl } from '@@/server/integrations/video/zoom'
import { useEnv } from '@@/server/config/env'
import { requireAuthSession } from '@@/server/services/session'
import { createOAuthPkce } from '@@/server/security/oauth'

export default defineEventHandler(async (event) => {
  await requireAuthSession(event)
  const state = randomBytes(32).toString('base64url')
  const pkce = createOAuthPkce()

  const cookieOptions = {
    httpOnly: true,
    secure: new URL(useEnv().siteUrl).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/api/integrations/zoom',
    maxAge: 10 * 60
  }

  setCookie(event, 'calendza_zoom_state', state, {
    ...cookieOptions
  })
  setCookie(event, 'calendza_zoom_pkce', pkce.verifier, cookieOptions)

  return sendRedirect(event, zoomAuthorizationUrl(state, pkce.challenge))
})
