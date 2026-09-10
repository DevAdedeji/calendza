import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useRoutingFormEditor } from '@/composables/routing/useRoutingFormEditor'
import { useWorkflowManager } from '@/composables/workflows/useWorkflowManager'
import { routingFormsApi, type RoutingFormRecord, type RoutingFormSummary } from '@/services/api/routing'
import type { WorkflowRecord } from '@/services/api/workflows'

const cleanups: Array<() => void> = []
const eventId = '22222222-2222-4222-8222-222222222222'
const questionId = '11111111-1111-4111-8111-111111111111'

function routingRecord(id = 'first'): RoutingFormRecord {
  return {
    id, title: id, slug: id, description: null, active: true, defaultEventTypeId: eventId,
    questions: [{ id: questionId, label: 'Topic', options: ['Sales', 'Support'], required: true }],
    rules: [{ name: 'Sales', eventTypeId: eventId, conditions: [{ questionId, operator: 'equals', value: 'Sales' }] }]
  }
}

function summary(id: string): RoutingFormSummary {
  return { ...routingRecord(id), defaultEventTitle: 'Call', responseCount: 0, createdAt: '' }
}

function routingHarness() {
  const scope = effectScope()
  const teamSlug = ref<string>()
  cleanups.push(() => scope.stop())
  const editor = scope.run(() => useRoutingFormEditor({
    teamSlug, eventTypes: [{ id: eventId, title: 'Call', slug: 'call' }], refresh: vi.fn()
  }))!
  return { ...editor, teamSlug }
}

beforeEach(() => {
  vi.stubGlobal('useFeedback', () => ({ success: vi.fn(), error: vi.fn() }))
  vi.stubGlobal('useCopy', () => ({ copied: ref(false), copy: vi.fn() }))
})

afterEach(() => {
  cleanups.splice(0).forEach(stop => stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('independent editor drafts', () => {
  it('copies reactive workflow actions without throwing or mutating the saved record', () => {
    const scope = effectScope()
    cleanups.push(() => scope.stop())
    const editor = scope.run(() => useWorkflowManager({ teamSlug: undefined, refresh: vi.fn() }))!
    const original = reactive<WorkflowRecord>({
      id: 'workflow', name: 'Welcome', trigger: 'booking_created', offsetMinutes: 0,
      action: { type: 'email', recipient: 'attendee', subject: 'Hello', body: 'Welcome' },
      active: true, eventTypeId: null, eventTypeTitle: null, webhookConfigured: false,
      createdAt: '', updatedAt: ''
    })
    editor.startEdit(original)
    expect(editor.form.action.type).toBe('email')
    if (editor.form.action.type === 'email') editor.form.action.subject = 'Changed'
    expect(original.action).toMatchObject({ subject: 'Hello' })
    expect(editor.modalOpen.value).toBe(true)
  })

  it('deep copies reactive routing questions and conditions', () => {
    const editor = routingHarness()
    const original = reactive(routingRecord())
    editor.resetForm(original)
    editor.form.questions[0]!.options[0] = 'Changed'
    editor.form.rules[0]!.conditions[0]!.value = 'Changed'
    expect(original.questions[0]!.options[0]).toBe('Sales')
    expect(original.rules[0]!.conditions[0]!.value).toBe('Sales')
  })

  it('ignores an older routing form response after another record opens', async () => {
    let finish!: (value: RoutingFormRecord) => void
    vi.spyOn(routingFormsApi, 'get')
      .mockReturnValueOnce(new Promise((resolve) => {
        finish = resolve
      }))
      .mockResolvedValueOnce(routingRecord('second'))
    const editor = routingHarness()
    const oldLoad = editor.startEdit(summary('first'))
    await editor.startEdit(summary('second'))
    finish(routingRecord('first'))
    await oldLoad
    expect(editor.editingId.value).toBe('second')
    expect(editor.form.title).toBe('second')
    expect(editor.loadingForm.value).toBe(false)
  })

  it.each(['create', 'close', 'team'] as const)('invalidates a pending routing load on %s', async (action) => {
    let finish!: (value: RoutingFormRecord) => void
    vi.spyOn(routingFormsApi, 'get').mockReturnValue(new Promise((resolve) => {
      finish = resolve
    }))
    const editor = routingHarness()
    const pending = editor.startEdit(summary('old'))
    await nextTick()
    if (action === 'create') editor.startCreate()
    else if (action === 'close') editor.modalOpen.value = false
    else editor.teamSlug.value = 'another-team'
    await nextTick()
    finish(routingRecord('old'))
    await pending
    expect(editor.form.title).not.toBe('old')
  })

  it('guards option indexes and caps questions and routes at schema limits', () => {
    const editor = routingHarness()
    editor.resetForm(routingRecord())
    const question = editor.form.questions[0]!
    question.options.push('Billing')
    editor.removeOption(question, -1)
    expect(question.options).toEqual(['Sales', 'Support', 'Billing'])
    for (let i = 0; i < 25; i++) {
      editor.addQuestion()
      editor.addRoute()
    }
    expect(editor.form.questions).toHaveLength(10)
    expect(editor.form.rules).toHaveLength(20)
  })
})
