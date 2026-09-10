import type { Ref } from 'vue'
import { bookingQuestionTypeSchema, type BookingQuestion } from '#shared/validation'

const QUESTION_TYPE_OPTIONS = [
  { label: 'Short answer', value: 'short_text' },
  { label: 'Long answer', value: 'long_text' },
  { label: 'Choose one', value: 'select' }
]

export function useBookingQuestions(questions: Ref<BookingQuestion[]>) {
  function addQuestion() {
    if (questions.value.length >= 10) return
    questions.value.push({ id: crypto.randomUUID(), label: '', type: 'short_text', required: false, options: [] })
  }

  function removeQuestion(index: number) {
    if (index < 0 || index >= questions.value.length) return
    questions.value.splice(index, 1)
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    if (index < 0 || index >= questions.value.length) return
    const target = index + direction
    if (target < 0 || target >= questions.value.length) return
    const [question] = questions.value.splice(index, 1)
    if (question) questions.value.splice(target, 0, question)
  }

  function changeQuestionType(question: BookingQuestion, value: unknown) {
    const parsed = bookingQuestionTypeSchema.safeParse(value)
    if (!parsed.success) return
    const type = parsed.data
    question.type = type
    question.options = type === 'select'
      ? question.options.length >= 2 ? question.options : ['Option 1', 'Option 2']
      : []
  }

  function addQuestionOption(question: BookingQuestion) {
    if (question.options.length < 20) question.options.push(`Option ${question.options.length + 1}`)
  }

  function removeQuestionOption(question: BookingQuestion, index: number) {
    if (index >= 0 && index < question.options.length && question.options.length > 2) question.options.splice(index, 1)
  }

  return {
    questionTypeOptions: QUESTION_TYPE_OPTIONS,
    addQuestion, removeQuestion, moveQuestion, changeQuestionType,
    addQuestionOption, removeQuestionOption
  }
}
