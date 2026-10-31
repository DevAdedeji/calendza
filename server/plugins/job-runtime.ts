import { useEnv } from '@@/server/config/env'
import { createJobRuntime } from '@@/server/services/job-runtime'

const WORKER_HEALTH_PATHS = new Set(['/api/healthz', '/api/readyz'])

export default defineNitroPlugin(async (nitro) => {
  if (import.meta.prerender) return
  const role = useEnv().processRole
  if (role === 'web') return

  if (role === 'worker') {
    // The shared Nitro bundle contains prerendered pages, so enforce isolation
    // at the final response boundary rather than relying on route middleware.
    nitro.hooks.hook('beforeResponse', (event, response) => {
      if (WORKER_HEALTH_PATHS.has(getRequestURL(event).pathname)) return
      setResponseStatus(event, 404, 'Not Found')
      response.body = { statusCode: 404, statusMessage: 'Not found' }
      removeResponseHeader(event, 'Content-Length')
      setResponseHeader(event, 'Cache-Control', 'no-store')
      setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    })
  }

  const runtime = createJobRuntime({ role })
  await runtime.start()

  // Runs after committed mutations, including provider callbacks. Health probes and
  // ordinary read-only requests must not restart idle queue polling.
  const wakeAfterMutation = (event: import('h3').H3Event) => {
    const path = event.path.split('?')[0] ?? ''
    if (path.startsWith('/api/') && (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)
      || (event.method === 'GET' && (path.includes('/callback') || path.startsWith('/api/auth/'))))) {
      runtime.wake()
    }
  }
  nitro.hooks.hook('afterResponse', wakeAfterMutation)
  nitro.hooks.hook('error', (_error, context) => {
    if (context.event) wakeAfterMutation(context.event)
  })

  nitro.hooks.hook('close', () => runtime.stop())
})
