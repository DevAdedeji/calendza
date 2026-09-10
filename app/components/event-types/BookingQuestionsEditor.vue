<script setup lang="ts">
import type { BookingQuestion } from '#shared/validation'
import { useBookingQuestions } from '@/composables/event-types/useBookingQuestions'

const questions = defineModel<BookingQuestion[]>({ required: true })
const {
  questionTypeOptions, addQuestion, removeQuestion, moveQuestion,
  changeQuestionType, addQuestionOption, removeQuestionOption
} = useBookingQuestions(questions)
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 border-b border-default px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-[13px] leading-relaxed text-muted">
        Name and email are always requested. Add up to 10 of your own.
      </p>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-plus"
        class="w-full shrink-0 justify-center sm:w-auto"
        :disabled="questions.length >= 10"
        @click="addQuestion"
      >
        Add question
      </UButton>
    </div>

    <div
      v-if="questions.length"
      class="space-y-3 px-5 py-5"
    >
      <div
        v-for="(question, questionIndex) in questions"
        :key="question.id"
        class="rounded-xl border border-default bg-muted p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-[13px] font-semibold text-muted">
            Question {{ questionIndex + 1 }}
          </p>
          <div class="flex items-center gap-0.5">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-arrow-up"
              class="size-7 justify-center p-0"
              :disabled="questionIndex === 0"
              :aria-label="`Move question ${questionIndex + 1} up`"
              @click="moveQuestion(questionIndex, -1)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-arrow-down"
              class="size-7 justify-center p-0"
              :disabled="questionIndex === questions.length - 1"
              :aria-label="`Move question ${questionIndex + 1} down`"
              @click="moveQuestion(questionIndex, 1)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              class="size-7 justify-center p-0 hover:text-error"
              :aria-label="`Delete question ${questionIndex + 1}`"
              @click="removeQuestion(questionIndex)"
            />
          </div>
        </div>

        <div class="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <UFormField
            label="Question"
            :name="`bookingQuestions.${questionIndex}.label`"
            required
          >
            <UInput
              v-model="question.label"
              :maxlength="120"
              placeholder="What would you like to discuss?"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Answer type"
            :name="`bookingQuestions.${questionIndex}.type`"
          >
            <USelectMenu
              aria-label="Answer type"
              :model-value="question.type"
              :items="questionTypeOptions"
              value-key="value"
              label-key="label"
              class="w-full"
              @update:model-value="changeQuestionType(question, $event)"
            />
          </UFormField>
        </div>

        <div
          v-if="question.type === 'select'"
          class="mt-4 rounded-lg border border-default bg-default p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-[13px] font-medium text-toned">
              Choices
            </p>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-plus"
              :disabled="question.options.length >= 20"
              @click="addQuestionOption(question)"
            >
              Add choice
            </UButton>
          </div>
          <div class="mt-2 space-y-2">
            <div
              v-for="(_option, optionIndex) in question.options"
              :key="optionIndex"
              class="flex items-center gap-2"
            >
              <span class="size-2 shrink-0 rounded-full border border-default" />
              <UInput
                v-model="question.options[optionIndex]"
                :maxlength="80"
                :aria-label="`Choice ${optionIndex + 1}`"
                class="min-w-0 flex-1"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="size-7 justify-center p-0"
                :disabled="question.options.length <= 2"
                :aria-label="`Remove choice ${optionIndex + 1}`"
                @click="removeQuestionOption(question, optionIndex)"
              />
            </div>
          </div>
        </div>

        <label class="mt-4 flex cursor-pointer items-center gap-2.5 text-[14px] text-toned">
          <UCheckbox v-model="question.required" />
          Guests must answer this question
        </label>
      </div>
    </div>

    <div
      v-else
      class="px-5 py-7 text-center"
    >
      <UIcon
        name="i-lucide-message-circle-question"
        class="mx-auto size-5 text-dimmed"
      />
      <p class="mt-2 text-[14px] font-medium text-toned">
        No extra questions
      </p>
      <p class="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
        Guests will only provide their name, email and optional notes.
      </p>
    </div>
  </div>
</template>
