import { afterEach, describe, expect, it, vi } from 'vitest'

const headers = vi.hoisted(() => ({ set: vi.fn(), remove: vi.fn() }))
vi.mock('h3', () => ({ setResponseHeaders: headers.set, removeResponseHeader: headers.remove }))
vi.mock('@@/server/config/env', () => ({ useEnv: () => ({ siteUrl: 'https://calendza.xyz' }) }))

afterEach(() => vi.unstubAllGlobals())

describe('checkout security policy', () => {
  it('allows Bachs checkout on SPA entry pages without allowing arbitrary scripts or framing the app', async () => {
    type Handler = (event: { path: string }) => void
    const hooks = new Map<string, Handler>()
    vi.stubGlobal('defineNitroPlugin', (plugin: (app: { hooks: { hook: (name: string, handler: Handler) => void } }) => void) => plugin)
    const { default: plugin } = await import('@@/server/plugins/security-headers')
    plugin({ hooks: { hook: (name: string, handler: Handler) => hooks.set(name, handler) } } as never)

    for (const path of ['/dashboard', '/billing', '/t/demo/billing']) {
      headers.set.mockClear()
      hooks.get('request')!({ path })
      const result = Object.assign({}, ...headers.set.mock.calls.map(call => call[1]))
      const csp = result['Content-Security-Policy'].split('; ')
      expect(csp).toContain('script-src \'self\' \'unsafe-inline\' https://checkout.bachs.io https://sandbox-checkout.bachs.io')
      expect(csp).toContain('frame-src \'self\' https://checkout.bachs.io https://sandbox-checkout.bachs.io')
      expect(csp).toContain('frame-ancestors \'none\'')
      expect(csp).toContain('connect-src \'self\'')
      expect(result['X-Frame-Options']).toBe('DENY')
    }
  })
})
