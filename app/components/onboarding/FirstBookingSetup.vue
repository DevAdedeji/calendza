<script setup lang="ts">
import { firstBookingDetailsSchema, firstBookingScheduleSchema, firstBookingSetupSchema } from '#shared/onboarding'
import type { MeetingLocationType } from '#shared/validation'
import { onboardingApi, type FirstBookingSetup } from '@/services/api/onboarding'
import { apiErrorMessage } from '@/services/api/http'

const props = defineProps<{ setup: FirstBookingSetup, username: string }>()
const form = reactive({
  event: { ...props.setup.event },
  schedule: { ...props.setup.schedule, rules: props.setup.schedule.rules.map(rule => ({ ...rule })) }
})
const step = ref(0)
const finished = ref(props.setup.status === 'completed')
const saving = ref(false)
const skipping = ref(false)
const error = ref('')
const fieldErrors = ref<Partial<Record<string, string>>>({})
const hoursError = computed(() => Object.entries(fieldErrors.value).find(([field]) => field.startsWith('rules'))?.[1])
for (const field of ['title', 'slug', 'durationMinutes', 'locationType', 'locationDetails'] as const) {
  watch(() => form.event[field], () => {
    fieldErrors.value[field] = undefined
  })
}
watch(() => form.schedule.timeZone, () => {
  fieldErrors.value.timeZone = undefined
})
watch(() => form.schedule.rules, () => {
  fieldErrors.value = Object.fromEntries(Object.entries(fieldErrors.value).filter(([field]) => !field.startsWith('rules')))
}, { deep: true })
const heading = useTemplateRef('heading')
const { url, host } = useSiteUrl()
const { copy, copied } = useCopy()
const feedback = useFeedback()
const link = computed(() => `${url.value}/${props.username}/${form.event.slug}`)
const displayLink = computed(() => `${host.value}/${props.username}/${form.event.slug}`)
const zones = [...new Set(['UTC', form.schedule.timeZone, ...Intl.supportedValuesOf('timeZone')])]
const steps = ['Your meeting', 'Your availability', 'Meeting location']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const locations: { value: MeetingLocationType, label: string }[] = [
  { value: 'custom', label: 'I’ll share meeting details myself' },
  { value: 'video_link', label: 'An existing video link' },
  { value: 'phone', label: 'Phone call' },
  { value: 'in_person', label: 'In person' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'zoom', label: 'Zoom' }
]
const locationOptions = locations.map(location => ({
  ...location,
  disabled: !props.setup.availableLocations.includes(location.value),
  label: props.setup.availableLocations.includes(location.value) ? location.label : `${location.label} (connect later)`
}))
const automaticLocation = computed(() => ['google_meet', 'microsoft_teams', 'zoom'].includes(form.event.locationType))
const locationLabels: Partial<Record<MeetingLocationType, string>> = {
  video_link: 'Meeting link', phone: 'Call instructions', in_person: 'Address'
}
const locationLabel = computed(() => locationLabels[form.event.locationType] ?? 'Meeting instructions')

function toggleDay(weekday: number, enabled: boolean) {
  form.schedule.rules = form.schedule.rules.filter(rule => rule.weekday !== weekday)
  if (enabled) form.schedule.rules.push({ weekday, start: '09:00', end: '17:00' })
}

async function focusHeading() {
  await nextTick()
  heading.value?.focus()
}

function back() {
  error.value = ''
  fieldErrors.value = {}
  step.value--
  void focusHeading()
}

async function next() {
  if (saving.value || skipping.value) return
  error.value = ''
  fieldErrors.value = {}
  const parsed = step.value === 0
    ? firstBookingDetailsSchema.safeParse(form.event)
    : step.value === 1 ? firstBookingScheduleSchema.safeParse(form.schedule) : firstBookingSetupSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = (step.value === 2 ? issue.path.slice(1) : issue.path).join('.')
      fieldErrors.value[field] ??= field === 'durationMinutes' ? 'Choose a duration between 5 and 720 minutes.' : issue.message
    }
    return
  }
  if (step.value < 2) {
    step.value++
    await focusHeading()
    return
  }
  saving.value = true
  try {
    const result = await onboardingApi.complete(form)
    form.event.slug = result.slug
    finished.value = true
    await refreshNuxtData('current-user')
    await focusHeading()
  } catch (failure) {
    error.value = apiErrorMessage(failure, 'Could not save your link. Your details are still here. Try again.')
  } finally {
    saving.value = false
  }
}

async function skip() {
  if (saving.value || skipping.value) return
  skipping.value = true
  error.value = ''
  try {
    await onboardingApi.skip()
    await refreshNuxtData('current-user')
    await navigateTo('/dashboard')
  } catch (failure) {
    error.value = apiErrorMessage(failure, 'Could not skip setup just now. Please try again.')
  } finally {
    skipping.value = false
  }
}

async function copyLink() {
  if (await copy(link.value)) feedback.success({ title: 'Booking link copied' })
  else feedback.error({ title: 'Could not copy booking link' })
}
</script>

<template>
  <section class="rounded-2xl border border-default bg-default p-6 shadow-sm sm:p-9">
    <template v-if="finished">
      <span class="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
        <UIcon
          name="i-lucide-check"
          class="size-6"
        />
      </span>
      <h1
        ref="heading"
        tabindex="-1"
        class="mt-6 font-editorial text-4xl text-highlighted focus:outline-none"
      >
        Your link is ready.
      </h1>
      <p class="mt-3 text-muted">
        Share it whenever you’re ready. You can change the details in Event types.
      </p>
      <div class="mt-7 rounded-xl border border-default bg-muted p-5">
        <p class="font-semibold text-highlighted">
          {{ form.event.title }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ form.event.durationMinutes }} minutes · {{ form.schedule.timeZone }}
        </p>
        <p class="mt-4 break-all text-sm text-highlighted">
          {{ displayLink }}
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            @click="copyLink"
          >
            {{ copied ? 'Copied' : 'Copy link' }}
          </UButton>
          <UButton
            :to="link"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-external-link"
          >
            Preview booking page
          </UButton>
        </div>
      </div>
      <p class="mt-6 text-sm leading-relaxed text-muted">
        Want to avoid calendar clashes or create video links automatically? You can connect your calendar and video apps from Integrations.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UButton to="/dashboard">
          Go to dashboard
        </UButton>
        <UButton
          to="/integrations"
          color="neutral"
          variant="ghost"
        >
          Connect a calendar
        </UButton>
      </div>
    </template>

    <template v-else>
      <p class="text-xs font-semibold uppercase tracking-widest text-primary">
        Create your first event type
      </p>
      <ol
        aria-label="Setup progress"
        class="mt-6 flex gap-2"
      >
        <li
          v-for="(label, index) in steps"
          :key="label"
          :aria-current="step === index ? 'step' : undefined"
          class="flex-1"
        >
          <div
            class="h-1 rounded-full"
            :class="index <= step ? 'bg-primary' : 'bg-accented'"
          />
          <span
            class="mt-2 block text-xs"
            :class="step === index ? 'text-highlighted' : 'text-muted'"
          >{{ index + 1 }}. {{ label }}</span>
        </li>
      </ol>
      <h1
        ref="heading"
        tabindex="-1"
        class="mt-8 font-editorial text-4xl text-highlighted focus:outline-none"
      >
        {{ ['What are people booking?', 'When are you available?', 'Where will you meet?'][step] }}
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        {{ ['Give your meeting a name and choose its duration. You can change these later.', 'Choose the hours guests can book. All times below use your selected timezone.', 'No calendar connection required. Pick how you want to meet your guests.'][step] }}
      </p>

      <form
        class="mt-7 space-y-5"
        novalidate
        @submit.prevent="next"
      >
        <fieldset
          :disabled="saving || skipping"
          class="space-y-5"
        >
          <template v-if="step === 0">
            <UFormField
              label="Meeting name"
              :error="fieldErrors.title"
              required
            >
              <UInput
                v-model="form.event.title"
                maxlength="100"
                placeholder="e.g. Discovery call"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="Duration (minutes)"
              :error="fieldErrors.durationMinutes"
              required
            >
              <UInput
                v-model.number="form.event.durationMinutes"
                type="number"
                :min="5"
                :max="720"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="Booking link address"
              :error="fieldErrors.slug"
              :help="`${host}/${username}/`"
              required
            >
              <UInput
                v-model="form.event.slug"
                maxlength="64"
                class="w-full"
                size="lg"
                autocapitalize="none"
                :spellcheck="false"
              />
            </UFormField>
          </template>

          <template v-else-if="step === 1">
            <UFormField
              label="Timezone"
              :error="fieldErrors.timeZone"
              required
            >
              <USelectMenu
                v-model="form.schedule.timeZone"
                :items="zones"
                :search-input="{ placeholder: 'Search timezones…' }"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <div class="divide-y divide-default rounded-xl border border-default px-4">
              <div
                v-for="(day, index) in days"
                :key="day"
                class="py-3"
              >
                <div class="flex items-center gap-3">
                  <USwitch
                    :model-value="form.schedule.rules.some(rule => rule.weekday === index + 1)"
                    :aria-label="`Available on ${day}`"
                    @update:model-value="toggleDay(index + 1, $event)"
                  />
                  <span class="text-sm font-medium">{{ day }}</span>
                  <span
                    v-if="!form.schedule.rules.some(rule => rule.weekday === index + 1)"
                    class="ml-auto text-xs text-muted"
                  >Unavailable</span>
                </div>
                <div
                  v-for="(rule, ruleIndex) in form.schedule.rules.filter(rule => rule.weekday === index + 1)"
                  :key="ruleIndex"
                  class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
                >
                  <UInput
                    v-model="rule.start"
                    type="time"
                    :aria-label="`${day} start time ${ruleIndex + 1}`"
                    class="w-full"
                  />
                  <span class="text-sm text-muted">to</span>
                  <UInput
                    v-model="rule.end"
                    type="time"
                    :aria-label="`${day} finish time ${ruleIndex + 1}`"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
            <p
              v-if="hoursError"
              role="alert"
              class="text-sm text-error"
            >
              {{ hoursError }}
            </p>
            <p class="text-xs text-muted">
              Need a lunch break or a day off? You can add more time windows and date exceptions in Availability later.
            </p>
          </template>

          <template v-else>
            <UFormField
              label="Meeting location"
              :error="fieldErrors.locationType"
              required
            >
              <USelect
                v-model="form.event.locationType"
                :items="locationOptions"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField
              v-if="!automaticLocation"
              :label="locationLabel"
              :error="fieldErrors.locationDetails"
              help="Guests receive these details with their booking confirmation."
              required
            >
              <UTextarea
                v-model="form.event.locationDetails"
                maxlength="500"
                :rows="3"
                class="w-full"
              />
            </UFormField>
            <p
              v-else
              class="rounded-lg bg-muted p-4 text-sm text-muted"
            >
              A meeting link will be created automatically when a guest books.
            </p>
            <div class="rounded-xl bg-muted p-4 text-sm text-muted">
              <p class="font-medium text-highlighted">
                {{ form.event.title }} · {{ form.event.durationMinutes }} minutes
              </p>
              <p class="mt-2 break-all">
                {{ displayLink }}
              </p>
              <p class="mt-2">
                {{ new Set(form.schedule.rules.map(rule => rule.weekday)).size }} available days per week · {{ form.schedule.timeZone }}
              </p>
            </div>
          </template>
        </fieldset>

        <p
          v-if="error"
          role="alert"
          class="rounded-lg border border-error/20 bg-error/5 p-3 text-sm text-error"
        >
          {{ error }}
        </p>
        <div class="flex items-center justify-between gap-3 border-t border-default pt-5">
          <UButton
            v-if="step > 0"
            type="button"
            color="neutral"
            variant="soft"
            :disabled="saving || skipping"
            @click="back"
          >
            Back
          </UButton>
          <span v-else />
          <UButton
            type="submit"
            size="lg"
            :loading="saving"
            :disabled="skipping"
          >
            {{ step === 2 ? 'Save my booking link' : 'Continue' }}
          </UButton>
        </div>
      </form>
      <div class="mt-5 text-center">
        <UButton
          color="neutral"
          variant="link"
          :loading="skipping"
          :disabled="saving"
          class="underline"
          @click="skip"
        >
          Skip for now
        </UButton>
        <p class="mt-1 text-xs text-muted">
          No event will be created. You can create your first event type from the dashboard later.
        </p>
      </div>
    </template>
  </section>
</template>
