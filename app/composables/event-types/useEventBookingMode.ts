import { computed, watch } from 'vue'
import type { EventTypeInput } from '#shared/validation'

type BookingModeFields = Pick<EventTypeInput,
  'capacity' | 'paymentEnabled' | 'priceCents' | 'requiresConfirmation' | 'recurringBookingEnabled'>

export function useEventBookingMode(form: BookingModeFields) {
  const groupEventEnabled = computed({
    get: () => form.capacity > 1,
    set: (enabled) => {
      form.capacity = enabled ? 10 : 1
      if (enabled) form.recurringBookingEnabled = false
    }
  })
  const paidBookingEnabled = computed({
    get: () => form.paymentEnabled,
    set: (enabled: boolean) => {
      form.paymentEnabled = enabled
      form.priceCents = enabled ? (form.priceCents ?? 2500) : null
      if (enabled) {
        form.requiresConfirmation = false
        form.recurringBookingEnabled = false
      }
    }
  })
  const priceAmount = computed({
    get: () => form.priceCents === null ? undefined : form.priceCents / 100,
    set: (value: number | undefined) => { form.priceCents = value === undefined ? null : Math.round(value * 100) }
  })

  watch(() => form.requiresConfirmation, (required) => {
    if (required) form.recurringBookingEnabled = false
  })

  return { groupEventEnabled, paidBookingEnabled, priceAmount }
}
