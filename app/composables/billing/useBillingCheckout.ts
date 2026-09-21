import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useBachsCheckout, useBachsPaymentConfirmation } from 'bachs-vue'
import { trustedCheckoutUrl } from '#shared/bachs-checkout'
import { apiErrorMessage } from '@/services/api/http'

export function useBillingCheckout(options: {
  selection: MaybeRefOrGetter<string>
  createSession: (requestId: string) => Promise<{ checkoutUrl: string, reference: string }>
  isConfirmed: (reference: string) => boolean
  refresh: (signal?: AbortSignal) => Promise<unknown>
}) {
  const sessionUrl = ref<string | null>(null)
  const sessionReference = ref<string | null>(null)
  const message = ref('')
  const error = ref('')
  const refreshing = ref(false)
  const awaitingConfirmation = ref(false)
  let requestId: string | undefined
  let generation = 0
  let disposed = false
  let ownsCheckout = false

  const confirmation = useBachsPaymentConfirmation({
    intervalMs: 2_000,
    maxAttempts: 6,
    timeoutMs: 20_000,
    async check(reference, { signal }) {
      await options.refresh(signal)
      return { status: options.isConfirmed(reference) ? 'confirmed' : 'pending' }
    }
  })

  watch(confirmation.status, (status) => {
    if (status === 'timeout') {
      message.value = 'Payment is still awaiting confirmation. Check again before starting another payment.'
    } else if (status === 'error') {
      error.value = 'Could not refresh billing. Check again before starting another payment.'
    }
  })

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
    if (disposed || refreshing.value || confirmation.isChecking.value) return
    if (awaitingConfirmation.value && sessionReference.value) {
      error.value = ''
      message.value = 'Checkout finished. Your plan updates once Bachs confirms payment.'
      await confirmation.start(sessionReference.value)
      return
    }
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
    confirmation.stop()
    const shouldClose = ownsCheckout
    ownsCheckout = false
    if (shouldClose) checkout.close()
    sessionUrl.value = null
    sessionReference.value = null
    requestId = undefined
    message.value = ''
    error.value = ''
    awaitingConfirmation.value = false
    refreshing.value = false
  }

  function stopChecking() {
    confirmation.stop()
    message.value = 'Automatic checks stopped. Payment may still complete. Check again before starting another payment.'
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
        if (!disposed && attempt === generation) {
          sessionUrl.value = url
          sessionReference.value = session.reference
        }
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
  // Only the server's matching paid invoice confirms this checkout.
  watch(() => !confirmation.isChecking.value
    && sessionReference.value !== null
    && options.isConfirmed(sessionReference.value), (confirmed) => {
    if (confirmed) reset()
  })
  onScopeDispose(() => {
    disposed = true
    reset()
  })

  return {
    open,
    refreshStatus,
    stopChecking,
    confirming: confirmation.isChecking,
    close: checkout.close,
    isLoading: checkout.isLoading,
    isBusy: checkout.isBusy,
    disabled: computed(() => checkout.isBusy.value || awaitingConfirmation.value),
    fallbackUrl: computed(() => awaitingConfirmation.value ? null : sessionUrl.value),
    message,
    error,
    refreshing: computed(() => refreshing.value || confirmation.isChecking.value)
  }
}
