import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useBachsCheckout } from 'bachs-vue'
import { trustedCheckoutUrl } from '#shared/bachs-checkout'
import { apiErrorMessage } from '@/services/api/http'

export function useBillingCheckout(options: {
  selection: MaybeRefOrGetter<string>
  createSession: (requestId: string) => Promise<{ checkoutUrl: string }>
  refresh: () => Promise<unknown>
}) {
  const sessionUrl = ref<string | null>(null)
  const message = ref('')
  const error = ref('')
  const refreshing = ref(false)
  const awaitingConfirmation = ref(false)
  let requestId: string | undefined
  let generation = 0
  let disposed = false
  let ownsCheckout = false

  const checkout = useBachsCheckout({
    onEvent(event) {
      if (!ownsCheckout || disposed) return
      if (event.type === 'checkout.completed') {
        awaitingConfirmation.value = true
        message.value = 'Checkout finished. Your plan updates once Bachs confirms payment.'
        void refreshStatus()
      } else if (event.type === 'checkout.expired') {
        sessionUrl.value = null
        requestId = undefined
        message.value = 'This checkout expired. You can start a new checkout.'
      } else if (event.type === 'checkout.failed') {
        message.value = 'Payment was not confirmed. You can reopen the same checkout to try again.'
      } else if (event.type === 'checkout.error') {
        error.value = 'Checkout could not continue here. Use the secure checkout page below.'
      } else if (event.type === 'checkout.closed' && !awaitingConfirmation.value) {
        message.value = 'Checkout closed. Closing the window does not cancel a payment already in progress.'
        void refreshStatus()
      }
    }
  })

  async function refreshStatus() {
    if (disposed || refreshing.value) return
    const attempt = generation
    refreshing.value = true
    error.value = ''
    try {
      await options.refresh()
    } catch {
      if (!disposed && attempt === generation) error.value = 'Could not refresh billing. Check again before starting another payment.'
    } finally {
      if (!disposed && attempt === generation) refreshing.value = false
    }
  }

  function reset() {
    generation++
    const shouldClose = ownsCheckout
    ownsCheckout = false
    if (shouldClose) checkout.close()
    sessionUrl.value = null
    requestId = undefined
    message.value = ''
    error.value = ''
    awaitingConfirmation.value = false
    refreshing.value = false
  }

  async function open() {
    if (disposed || checkout.isBusy.value || awaitingConfirmation.value) return
    const attempt = generation
    error.value = ''
    message.value = ''
    ownsCheckout = true
    try {
      await checkout.open(async () => {
        if (sessionUrl.value) return sessionUrl.value
        requestId ??= crypto.randomUUID()
        const session = await options.createSession(requestId)
        const url = trustedCheckoutUrl(session.checkoutUrl)
        if (!disposed && attempt === generation) sessionUrl.value = url
        return url
      })
    } catch (failure) {
      if (!disposed && attempt === generation) {
        error.value = sessionUrl.value
          ? 'Checkout could not open here. Continue on the secure checkout page below.'
          : apiErrorMessage(failure, 'Could not start checkout. Please try again.')
      }
    }
  }

  watch(() => toValue(options.selection), reset, { flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    reset()
  })

  return {
    open,
    refreshStatus,
    close: checkout.close,
    isLoading: checkout.isLoading,
    isBusy: checkout.isBusy,
    disabled: computed(() => checkout.isBusy.value || awaitingConfirmation.value),
    fallbackUrl: computed(() => awaitingConfirmation.value ? null : sessionUrl.value),
    message,
    error,
    refreshing
  }
}
