import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useEventTypeForm } from '@/composables/event-types/useEventTypeForm'
import { useTeamEventTypeForm } from '@/composables/event-types/useTeamEventTypeForm'
import { useBookingQuestions } from '@/composables/event-types/useBookingQuestions'
import type { BookingQuestion, TeamEventTypeInput } from '@@/shared/validation'

const cleanups: Array<() => void> = []

function formHarness(kind: 'personal' | 'team') {
  const scope = effectScope()
  const editor = scope.run(() => kind === 'personal'
    ? useEventTypeForm({ eventType: null, schedules: [], googleConnection: null, microsoftConnection: null, zoomConnection: null })
    : useTeamEventTypeForm({ members: [], teamKey: 'team' }))!
  cleanups.push(() => scope.stop())
  return editor
}

afterEach(() => cleanups.splice(0).forEach(stop => stop()))

describe.each(['personal', 'team'] as const)('%s booking mode controls', (kind) => {
  it('disables recurrence for group events and restores one seat when switched off', () => {
    const editor = formHarness(kind)
    editor.form.recurringBookingEnabled = true
    editor.groupEventEnabled.value = true
    expect(editor.form.capacity).toBe(10)
    expect(editor.form.recurringBookingEnabled).toBe(false)
    editor.groupEventEnabled.value = false
    expect(editor.form.capacity).toBe(1)
  })

  it('enables paid bookings with the existing default and disables incompatible modes', () => {
    const editor = formHarness(kind)
    editor.form.requiresConfirmation = true
    editor.form.recurringBookingEnabled = true
    editor.paidBookingEnabled.value = true
    expect(editor.form.paymentEnabled).toBe(true)
    expect(editor.form.priceCents).toBe(2500)
    expect(editor.priceAmount.value).toBe(25)
    expect(editor.form.requiresConfirmation).toBe(false)
    expect(editor.form.recurringBookingEnabled).toBe(false)
  })

  it('keeps a saved price, converts edited amounts to cents, and clears disabled pricing', () => {
    const editor = formHarness(kind)
    editor.form.priceCents = 4250
    editor.paidBookingEnabled.value = true
    expect(editor.priceAmount.value).toBe(42.5)
    editor.priceAmount.value = 12.34
    expect(editor.form.priceCents).toBe(1234)
    editor.priceAmount.value = undefined
    expect(editor.form.priceCents).toBeNull()
    editor.paidBookingEnabled.value = false
    expect(editor.form.paymentEnabled).toBe(false)
    expect(editor.priceAmount.value).toBeUndefined()
  })

  it('disables recurrence when approval is required', async () => {
    const editor = formHarness(kind)
    editor.form.recurringBookingEnabled = true
    editor.form.requiresConfirmation = true
    await nextTick()
    expect(editor.form.recurringBookingEnabled).toBe(false)
  })

  it('keeps state independent between two open editors', () => {
    const first = formHarness(kind)
    const second = formHarness(kind)
    first.paidBookingEnabled.value = true
    first.groupEventEnabled.value = true
    expect(second.form.paymentEnabled).toBe(false)
    expect(second.form.capacity).toBe(1)
  })
})

describe('team event form drafts', () => {
  it('defaults new drafts to account currency without repricing existing events', () => {
    const currency = ref<'USD' | 'NGN'>('NGN')
    const editor = useTeamEventTypeForm({ members: [], teamKey: 'team', defaultCurrency: currency })
    expect(editor.form.paymentCurrency).toBe('NGN')
    editor.resetForm({ paymentCurrency: 'USD', priceCents: 2500 })
    expect(editor.form.paymentCurrency).toBe('USD')
    expect(editor.form.priceCents).toBe(2500)
    editor.resetForm()
    expect(editor.form.paymentCurrency).toBe('NGN')
  })

  it('uses the latest preference when opening a new personal draft, not while editing it', () => {
    const currency = ref<'USD' | 'NGN'>('NGN')
    const editor = useEventTypeForm({ eventType: null, schedules: [], googleConnection: null, microsoftConnection: null, zoomConnection: null, defaultCurrency: currency })
    editor.loadForm()
    expect(editor.form.paymentCurrency).toBe('NGN')
    currency.value = 'USD'
    expect(editor.form.paymentCurrency).toBe('NGN')
    editor.loadForm()
    expect(editor.form.paymentCurrency).toBe('USD')
  })

  it('does not mutate a loaded event or template before saving', () => {
    const scope = effectScope()
    cleanups.push(() => scope.stop())
    const editor = scope.run(() => useTeamEventTypeForm({ members: [], teamKey: 'team' }))!
    const original = ref<Partial<TeamEventTypeInput>>({
      additionalDurationMinutes: [45], reminderMinutes: [60],
      bookingQuestions: [{ id: 'question', label: 'Topic', type: 'select', required: true, options: ['One', 'Two'] }],
      hosts: [{ memberId: 'member', scheduleId: null, enabled: true, weight: 100 }]
    })
    editor.resetForm(original.value)
    editor.form.additionalDurationMinutes.push(90)
    editor.form.reminderMinutes.push(1440)
    editor.form.bookingQuestions[0]!.label = 'Changed'
    editor.form.bookingQuestions[0]!.options[0] = 'Changed'
    editor.form.hosts[0]!.weight = 200
    expect(original.value.additionalDurationMinutes).toEqual([45])
    expect(original.value.reminderMinutes).toEqual([60])
    expect(original.value.bookingQuestions?.[0]).toMatchObject({ label: 'Topic', options: ['One', 'Two'] })
    expect(original.value.hosts?.[0]?.weight).toBe(100)
    editor.resetForm()
    expect(editor.form.bookingQuestions).toEqual([])
    expect(editor.form.hosts).toEqual([])
    expect(editor.form.reminderMinutes).toEqual([1440, 60])
  })

  it('preserves deliberately empty reminders instead of restoring defaults', () => {
    const scope = effectScope()
    cleanups.push(() => scope.stop())
    const editor = scope.run(() => useTeamEventTypeForm({ members: [], teamKey: 'team' }))!
    editor.resetForm({ reminderMinutes: [] })
    expect(editor.form.reminderMinutes).toEqual([])
  })
})

describe('booking question editor', () => {
  function questionsHarness() {
    const questions = ref<BookingQuestion[]>([])
    return { questions, ...useBookingQuestions(questions) }
  }

  it('caps questions at ten and generates distinct stable identifiers', () => {
    const editor = questionsHarness()
    for (let i = 0; i < 11; i++) editor.addQuestion()
    expect(editor.questions.value).toHaveLength(10)
    expect(new Set(editor.questions.value.map(question => question.id)).size).toBe(10)
    const first = editor.questions.value[0]!.id
    editor.moveQuestion(0, 1)
    expect(editor.questions.value[1]!.id).toBe(first)
  })

  it('does not remove or reorder questions for out-of-range indices', () => {
    const editor = questionsHarness()
    editor.addQuestion()
    editor.addQuestion()
    const ids = editor.questions.value.map(question => question.id)
    editor.removeQuestion(-1)
    editor.removeQuestion(2)
    editor.moveQuestion(-1, 1)
    editor.moveQuestion(0, -1)
    editor.moveQuestion(1, 1)
    expect(editor.questions.value.map(question => question.id)).toEqual(ids)
  })

  it('initializes choice options, preserves edits and clears options for text answers', () => {
    const editor = questionsHarness()
    editor.addQuestion()
    const question = editor.questions.value[0]!
    editor.changeQuestionType(question, 'select')
    expect(question.options).toEqual(['Option 1', 'Option 2'])
    question.options[0] = 'Edited'
    editor.changeQuestionType(question, 'select')
    expect(question.options[0]).toBe('Edited')
    editor.changeQuestionType(question, 'invalid')
    expect(question.type).toBe('select')
    editor.changeQuestionType(question, 'long_text')
    expect(question.options).toEqual([])
  })

  it('keeps between two and twenty options for choice questions', () => {
    const editor = questionsHarness()
    editor.addQuestion()
    const question = editor.questions.value[0]!
    editor.changeQuestionType(question, 'select')
    editor.removeQuestionOption(question, 0)
    expect(question.options).toHaveLength(2)
    for (let i = 0; i < 25; i++) editor.addQuestionOption(question)
    expect(question.options).toHaveLength(20)
    editor.removeQuestionOption(question, -1)
    expect(question.options).toHaveLength(20)
    editor.removeQuestionOption(question, 0)
    expect(question.options).toHaveLength(19)
  })

  it('uses the current draft after the parent resets the question list', () => {
    const editor = questionsHarness()
    editor.addQuestion()
    const previous = editor.questions.value
    editor.questions.value = []
    editor.addQuestion()
    expect(editor.questions.value).toHaveLength(1)
    expect(previous).toHaveLength(1)
    expect(editor.questions.value[0]!.id).not.toBe(previous[0]!.id)
  })
})
