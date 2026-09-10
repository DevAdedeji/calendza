import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { apiErrorMessage } from '@/services/api/http'
import { bookingLinksApi } from '@/services/api/booking-links'
import { eventTypesApi } from '@/services/api/event-types'
import type { AvailabilityResponse } from '@/services/api/bookings'
import { useRequestGuard } from '@/composables/useRequestGuard'
import {
  addCalendarDateDays,
  addExactTime,
  calendarDateKey,
  formatCalendarDate,
  formatTime,
  todayCalendarDate
} from '@/utils/date-time'

interface BookingLinkOption {
  id: string
  title: string
  slug: string
  durationMinutes: number
  additionalDurationMinutes: number[]
  hidden: boolean
  locationType: string
  locationReady: boolean
}

export function useBookingLinkForm(options: {
  open: MaybeRefOrGetter<boolean>
  initialKind: MaybeRefOrGetter<'single_use' | 'one_off' | undefined>
  onCreated: () => void
}) {
  const { url: siteUrl } = useSiteUrl()
  const { copied, copy } = useCopy()
  const feedback = useFeedback()
  const {
    data: eventTypes,
    status: optionsStatus,
    error: optionsError,
    refresh: refreshOptions
  } = useFetch<{ items: BookingLinkOption[] }>(bookingLinksApi.optionsEndpoint)

  const kind = ref<'single_use' | 'one_off'>('single_use')
  const eventTypeId = ref('')
  const durationMinutes = ref<number | undefined>()
  const label = ref('')
  const expiryDays = ref('7')
  const selectedStarts = ref<string[]>([])
  const availability = ref<AvailabilityResponse | null>(null)
  const loadingSlots = ref(false)
  const slotError = ref('')
  const submitting = ref(false)
  const submitError = ref('')
  const createdUrl = ref('')
  const slotRequests = useRequestGuard()
  const submissions = useRequestGuard()

  const eventOptions = computed(() => (eventTypes.value?.items ?? []).map(item => ({
    label: `${item.title} · ${[item.durationMinutes, ...(item.additionalDurationMinutes ?? [])].join(' / ')} min${item.hidden ? ' · Hidden' : ''}${item.locationReady ? '' : ' · Setup needed'}`,
    value: item.id
  })))
  const selectedEvent = computed(() => eventTypes.value?.items.find(item => item.id === eventTypeId.value))
  const durationOptions = computed(() => selectedEvent.value
    ? [selectedEvent.value.durationMinutes, ...(selectedEvent.value.additionalDurationMinutes ?? [])]
    : [])

  async function loadSlots() {
    const current = slotRequests.begin()
    availability.value = null
    loadingSlots.value = false
    slotError.value = ''
    selectedStarts.value = []
    if (!toValue(options.open) || kind.value !== 'one_off' || !eventTypeId.value) return
    loadingSlots.value = true
    const from = todayCalendarDate()
    try {
      const result = await eventTypesApi.slots(eventTypeId.value, {
        from,
        to: addCalendarDateDays(from, 30),
        durationMinutes: durationMinutes.value
      })
      if (current()) availability.value = result
    } catch (failure) {
      if (!current()) return
      availability.value = null
      slotError.value = apiErrorMessage(failure, 'Could not load your available times.')
    } finally {
      if (current()) loadingSlots.value = false
    }
  }

  watch([kind, eventTypeId, durationMinutes], () => void loadSlots())
  watch(selectedEvent, (eventType) => {
    durationMinutes.value = eventType?.durationMinutes
  })

  const groupedSlots = computed(() => {
    const groups = new Map<string, AvailabilityResponse['slots']>()
    const timeZone = availability.value?.timeZone ?? 'UTC'
    for (const slot of availability.value?.slots ?? []) {
      const key = calendarDateKey(slot.start, timeZone)
      groups.set(key, [...(groups.get(key) ?? []), slot])
    }
    return [...groups.entries()]
  })

  function dayLabel(date: string) {
    return formatCalendarDate(date, { weekday: 'short', month: 'short', day: 'numeric' }, 'en')
  }

  function timeLabel(iso: string) {
    return formatTime(iso, availability.value?.timeZone ?? 'UTC', 'en')
  }

  function toggleSlot(start: string) {
    if (loadingSlots.value || !availability.value?.slots.some(slot => slot.start === start)) return
    selectedStarts.value = selectedStarts.value.includes(start)
      ? selectedStarts.value.filter(value => value !== start)
      : selectedStarts.value.length < 40 ? [...selectedStarts.value, start] : selectedStarts.value
  }

  function chooseKind(value: string) {
    if (value === 'single_use' || value === 'one_off') kind.value = value
  }

  const canSubmit = computed(() => Boolean(eventTypeId.value)
    && selectedEvent.value?.locationReady !== false
    && !loadingSlots.value
    && (kind.value === 'single_use' || selectedStarts.value.some(start => availability.value?.slots.some(slot => slot.start === start))))

  function reset() {
    kind.value = toValue(options.initialKind) ?? 'single_use'
    eventTypeId.value = eventTypes.value?.items[0]?.id ?? ''
    durationMinutes.value = eventTypes.value?.items[0]?.durationMinutes
    label.value = ''
    expiryDays.value = '7'
    selectedStarts.value = []
    availability.value = null
    slotError.value = ''
    submitError.value = ''
    createdUrl.value = ''
  }

  watch(() => toValue(options.open), (value) => {
    slotRequests.invalidate()
    submissions.invalidate()
    if (value) {
      reset()
      void loadSlots()
    }
  }, { immediate: true })
  watch(eventTypes, (value) => {
    if (toValue(options.open) && !eventTypeId.value) eventTypeId.value = value?.items[0]?.id ?? ''
  })

  async function create() {
    if (!toValue(options.open) || !canSubmit.value || submitting.value) return
    const current = submissions.begin()
    submitting.value = true
    submitError.value = ''
    try {
      const selected = (availability.value?.slots ?? []).filter(slot => selectedStarts.value.includes(slot.start))
      const expiry = kind.value === 'one_off'
        ? new Date(Math.max(...selected.map(slot => Date.parse(slot.end)))).toISOString()
        : addExactTime(Date.now(), { hours: Number(expiryDays.value) * 24 }).toISOString()
      const result = await bookingLinksApi.create({
        kind: kind.value, eventTypeId: eventTypeId.value, durationMinutes: durationMinutes.value,
        label: label.value.trim() || null,
        expiresAt: expiry, slots: selected
      })
      if (!current()) return
      createdUrl.value = `${siteUrl.value}${result.path}`
      options.onCreated()
    } catch (failure) {
      if (current()) submitError.value = apiErrorMessage(failure, 'Could not create this meeting link.')
    } finally {
      submitting.value = false
    }
  }

  async function copyCreated() {
    if (await copy(createdUrl.value)) feedback.success({ title: 'Private link copied' })
    else feedback.error({ title: 'Could not copy the link' })
  }

  return {
    copied, eventTypes, optionsStatus, optionsError, refreshOptions, kind,
    eventTypeId, durationMinutes, durationOptions, label, expiryDays, selectedStarts, availability, loadingSlots,
    slotError, submitting, submitError, createdUrl, eventOptions, selectedEvent,
    groupedSlots, dayLabel, timeLabel, toggleSlot, chooseKind, canSubmit,
    loadSlots, create, copyCreated
  }
}
