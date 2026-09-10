import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useBookingLinkForm } from '@/composables/booking/useBookingLinkForm'
import { useCalendarIntegration } from '@/composables/integrations/useCalendarIntegration'
import { eventTypesApi } from '@/services/api/event-types'
import type { AvailabilityResponse } from '@/services/api/bookings'
import type { CalendarConnection, CalendarsResponse } from '@/services/api/integrations'

const cleanups: Array<() => void> = []
const options = ref({ items: [{
  id: 'event', title: 'Call', slug: 'call', durationMinutes: 30, additionalDurationMinutes: [60],
  hidden: false, locationType: 'custom', locationReady: true
}] })
const connection = ref<CalendarConnection>({ connected: true, configured: true })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { resolve, promise }
}

function scoped<T>(create: () => T) {
  const scope = effectScope()
  cleanups.push(() => scope.stop())
  return { editor: scope.run(create)!, stop: () => scope.stop() }
}

function slots(start = '2030-01-07T10:00:00Z'): AvailabilityResponse {
  return { timeZone: 'UTC', slots: [{ start, end: '2030-01-07T11:00:00Z' }] }
}

function calendars(id = 'main'): CalendarsResponse {
  return {
    items: [{ id, summary: id, primary: true, accessRole: 'owner' }],
    conflictCalendarIds: [id], writeCalendarId: id
  }
}

beforeEach(() => {
  connection.value = { connected: true, configured: true }
  vi.stubGlobal('useFeedback', () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
  vi.stubGlobal('useCopy', () => ({ copied: ref(false), copy: vi.fn() }))
  vi.stubGlobal('useSiteUrl', () => ({ url: ref('http://localhost') }))
  vi.stubGlobal('useFetch', () => ({ data: options, status: ref('success'), error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('useLazyFetch', () => ({ data: connection, status: ref('success'), error: ref(null), refresh: vi.fn() }))
})

afterEach(() => {
  cleanups.splice(0).forEach(stop => stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('meeting link availability', () => {
  it('ignores an older duration response and prevents selecting stale slots', async () => {
    vi.spyOn(eventTypesApi, 'slots').mockResolvedValue(slots())
    const open = ref(true)
    const { editor } = scoped(() => useBookingLinkForm({ open, initialKind: 'one_off', onCreated: vi.fn() }))
    await nextTick()
    await Promise.resolve()
    const first = deferred<AvailabilityResponse>()
    const second = deferred<AvailabilityResponse>()
    vi.mocked(eventTypesApi.slots).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const oldLoad = editor.loadSlots()
    const newLoad = editor.loadSlots()
    editor.toggleSlot('2030-01-07T10:00:00Z')
    expect(editor.selectedStarts.value).toEqual([])
    expect(editor.canSubmit.value).toBe(false)
    second.resolve(slots('2030-01-07T10:30:00Z'))
    await newLoad
    first.resolve(slots())
    await oldLoad
    expect(editor.availability.value?.slots[0]?.start).toBe('2030-01-07T10:30:00Z')
    editor.toggleSlot('2030-01-07T10:30:00Z')
    expect(editor.canSubmit.value).toBe(true)
  })

  it('reloads availability when reopened with the same selection and disposes pending work', async () => {
    const fetch = vi.spyOn(eventTypesApi, 'slots').mockResolvedValue(slots())
    const open = ref(true)
    const { editor, stop } = scoped(() => useBookingLinkForm({ open, initialKind: 'one_off', onCreated: vi.fn() }))
    await nextTick()
    await Promise.resolve()
    open.value = false
    await nextTick()
    fetch.mockClear()
    open.value = true
    await nextTick()
    await Promise.resolve()
    expect(fetch).toHaveBeenCalled()
    const pending = deferred<AvailabilityResponse>()
    fetch.mockReturnValue(pending.promise)
    const loading = editor.loadSlots()
    stop()
    pending.resolve(slots())
    await loading
    expect(editor.availability.value).toBeNull()
  })
})

describe('calendar settings requests', () => {
  function harness() {
    return scoped(() => useCalendarIntegration({ provider: 'caldav', name: 'Apple', refreshSignal: undefined, onSaved: vi.fn() }))
  }

  it('ignores old forced refreshes and clears calendars after disconnection', async () => {
    const first = deferred<CalendarsResponse>()
    const second = deferred<CalendarsResponse>()
    vi.stubGlobal('$fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise))
    const { editor } = harness()
    const oldLoad = editor.loadCalendars(true)
    const newLoad = editor.loadCalendars(true)
    second.resolve(calendars('new'))
    await newLoad
    first.resolve(calendars('old'))
    await oldLoad
    expect(editor.writeCalendarId.value).toBe('new')
    connection.value = { connected: false, configured: true }
    await nextTick()
    expect(editor.calendars.value).toEqual([])
    expect(editor.writeCalendarId.value).toBe('')
  })

  it('does not mark edits made during a save as already saved', async () => {
    const save = deferred<{ ok: true, syncQueued: boolean }>()
    const fetch = vi.fn().mockResolvedValueOnce(calendars()).mockReturnValueOnce(save.promise)
    vi.stubGlobal('$fetch', fetch)
    const { editor } = harness()
    await editor.loadCalendars()
    editor.defaultForBookings.value = true
    const pending = editor.save()
    editor.selectedConflictIds.value.push('another')
    save.resolve({ ok: true, syncQueued: true })
    await pending
    expect(editor.dirty.value).toBe(true)
    expect(fetch.mock.calls[1]?.[1].body.conflictCalendarIds).toEqual(['main'])
  })

  it('does not apply a calendar response after component disposal', async () => {
    const request = deferred<CalendarsResponse>()
    vi.stubGlobal('$fetch', vi.fn().mockReturnValue(request.promise))
    const { editor, stop } = harness()
    const pending = editor.loadCalendars()
    stop()
    request.resolve(calendars())
    await pending
    expect(editor.calendars.value).toEqual([])
  })
})
