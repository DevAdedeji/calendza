import { z } from 'zod'
import { exchangeZoomCode, saveZoomConnection } from '@@/server/integrations/video/zoom'
import { enqueueFutureBookingsForCalendarSync } from '@@/server/services/calendar-sync'
import { requireAuthSession } from '@@/server/services/session'
import { matchesOAuthState } from '@@/server/security/oauth'
import { logEvent } from '@@/server/observability/logger'

const callbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(32).max(128)
})

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  const parsed = await getValidatedQuery(event, callbackQuery.safeParse)
  const expected = getCookie(event, 'calendza_zoom_state')
  const codeVerifier = getCookie(event, 'calendza_zoom_pkce')
  deleteCookie(event, 'calendza_zoom_state', { path: '/api/integrations/zoom' })
  deleteCookie(event, 'calendza_zoom_pkce', { path: '/api/integrations/zoom' })

  if (!parsed.success || !codeVerifier || !matchesOAuthState(parsed.data.state, expected)) {
    return sendRedirect(event, '/integrations?zoom=invalid-request')
  }

  try {
    const tokens = await exchangeZoomCode(parsed.data.code, codeVerifier)
    await saveZoomConnection(session.user.id, tokens)
  } catch (error) {
    logEvent('error', 'zoom_connection_failed', {
      userId: session.user.id,
      error
    }, event)
    return sendRedirect(event, '/integrations?zoom=connection-failed')
  }

  // Backfilling existing bookings is recoverable and must not turn a completed
  // OAuth connection into a false failure. Future confirmed bookings enqueue
  // their own jobs, and reconnecting reopens the backfill safely.
  try {
    await enqueueFutureBookingsForCalendarSync(session.user.id)
  } catch (error) {
    logEvent('error', 'zoom_booking_backfill_failed', {
      userId: session.user.id,
      error
    }, event)
  }

  return sendRedirect(event, '/integrations?zoom=connected')
})
