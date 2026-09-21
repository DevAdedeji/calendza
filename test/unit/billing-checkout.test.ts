import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, ref, type App } from 'vue'
import { createBachs, type BachsCheckoutEvent } from 'bachs-vue'
import { useBillingCheckout } from '@/composables/billing/useBillingCheckout'
import { trustedCheckoutUrl } from '#shared/bachs-checkout'

const sdk = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn(), close: vi.fn(), isOpen: vi.fn(), initialize: vi.fn() }))
vi.mock('@bachs/js', () => ({ loadBachs: sdk.load }))

const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, setElementText() {}, setText() {},
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  parentNode: () => null, nextSibling: () => null
})
const apps: App[] = []
const url = 'https://sandbox-checkout.bachs.io/c/test-session'
let sendEvent: (event: BachsCheckoutEvent) => void

function setup(createSession = vi.fn(async (_requestId: string) => ({ checkoutUrl: url })), refresh = vi.fn(async () => {})) {
  const selection = ref('personal:USD:monthly')
  let billing!: ReturnType<typeof useBillingCheckout>
  const app = renderer.createApp(defineComponent({
    setup() {
      billing = useBillingCheckout({ selection, createSession, refresh })
      return () => null
    }
  }))
  app.use(createBachs())
  app.mount({})
  apps.push(app)
  return { billing, selection, createSession, refresh, app }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {})
  let visible = false
  sdk.isOpen.mockImplementation(() => visible)
  sdk.open.mockImplementation(async (args) => {
    sendEvent = args.onEvent
    visible = true
    sendEvent({ type: 'checkout.opened', data: {} })
  })
  sdk.close.mockImplementation(() => {
    visible = false
    sendEvent?.({ type: 'checkout.closed', data: {} })
  })
  sdk.load.mockResolvedValue({ Initialize: sdk.initialize, Checkout: { open: sdk.open, close: sdk.close, isOpen: sdk.isOpen } })
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.unstubAllGlobals()
})

describe('billing checkout with bachs-vue', () => {
  it('opens one overlay and reuses the existing session after closing', async () => {
    const { billing, createSession } = setup()
    await Promise.all([billing.open(), billing.open()])
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(sdk.load).toHaveBeenCalledOnce()
    expect(billing.error.value).toBe('')
    expect(billing.disabled.value).toBe(true)
    billing.close()
    await billing.open()
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(billing.fallbackUrl.value).toBe(url)
  })

  it('keeps the same checkout URL for a full-page fallback if the SDK fails', async () => {
    sdk.load.mockRejectedValue(new Error('Script blocked'))
    const { billing, createSession } = setup()
    await billing.open()
    expect(billing.error.value).toContain('secure checkout page')
    expect(billing.fallbackUrl.value).toBe(url)
    await billing.open()
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('rejects an unsafe fallback before the SDK is loaded', async () => {
    const { billing } = setup(vi.fn(async () => ({ checkoutUrl: 'https://attacker.example/pay' })))
    await billing.open()
    expect(billing.fallbackUrl.value).toBeNull()
    expect(sdk.load).not.toHaveBeenCalled()
    expect(() => trustedCheckoutUrl('https://user:pass@checkout.bachs.io/c/test')).toThrow()
    expect(() => trustedCheckoutUrl('javascript:alert(1)')).toThrow()
  })

  it('uses a stable personal request ID after an uncertain server response', async () => {
    const createSession = vi.fn(async (_requestId: string) => ({ checkoutUrl: url }))
    createSession.mockRejectedValueOnce(new Error('Network timeout'))
    const { billing } = setup(createSession)
    await billing.open()
    await billing.open()
    expect(createSession.mock.calls[0]![0]).toBe(createSession.mock.calls[1]![0])
  })

  it('refreshes server state after completion without allowing a second payment', async () => {
    const { billing, refresh, createSession } = setup()
    await billing.open()
    sendEvent({ type: 'checkout.completed', data: {} })
    billing.close()
    await billing.open()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(billing.message.value).toContain('once Bachs confirms')
    expect(billing.disabled.value).toBe(true)
    expect(billing.fallbackUrl.value).toBeNull()
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('reports refresh failures without pretending the plan is active', async () => {
    const { billing } = setup(undefined, vi.fn(async () => {
      throw new Error('Unavailable')
    }))
    await billing.open()
    sendEvent({ type: 'checkout.completed', data: {} })
    await vi.waitFor(() => expect(billing.error.value).toContain('Could not refresh billing'))
    expect(billing.disabled.value).toBe(true)
  })

  it('invalidates the session when currency, interval or team changes', async () => {
    const { billing, selection, createSession } = setup()
    await billing.open()
    selection.value = 'team:acme:NGN:yearly:2'
    expect(billing.fallbackUrl.value).toBeNull()
    await billing.open()
    expect(createSession).toHaveBeenCalledTimes(2)
    expect(createSession.mock.calls[0]![0]).not.toBe(createSession.mock.calls[1]![0])
  })

  it('does not open a late session after leaving the page', async () => {
    let resolve!: (value: { checkoutUrl: string }) => void
    const { billing, app } = setup(vi.fn(() => new Promise<{ checkoutUrl: string }>((done) => {
      resolve = done
    })))
    const pending = billing.open()
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    resolve({ checkoutUrl: url })
    await pending
    expect(sdk.open).not.toHaveBeenCalled()
    expect(billing.fallbackUrl.value).toBeNull()
  })

  it('requests a fresh checkout only after the existing session expires', async () => {
    const { billing, createSession } = setup()
    await billing.open()
    sendEvent({ type: 'checkout.expired', data: {} })
    billing.close()
    await billing.open()
    expect(createSession).toHaveBeenCalledTimes(2)
  })
})
