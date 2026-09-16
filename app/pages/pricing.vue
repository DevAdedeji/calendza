<script setup lang="ts">
import { DEFAULT_BILLING_INTERVAL, PERSONAL_PRO_PLAN, TEAM_PLAN, formatUsd, type BillingInterval } from '#shared/billing'
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'
import { CONFIGURATION_WRITES_PER_MINUTE, WORKFLOW_DELIVERY_PER_HOUR } from '#shared/usage-protection'

definePageMeta({ layout: 'default' })

const origin = useRuntimeConfig().public.siteUrl || useRequestURL().origin
const { isSignedIn, accountDestination } = await useLandingNavigation()

// Signed in, "start a team" has to actually start one — sending them to the
// dashboard is what makes a marketing CTA feel broken.
const teamDestination = computed(() => isSignedIn.value ? '/t/new' : '/signup')
const personalCta = computed(() => isSignedIn.value ? 'Go to your dashboard' : 'Create your link')
const proDestination = computed(() => isSignedIn.value ? '/billing' : '/signup')
const proCta = computed(() => isSignedIn.value ? 'Upgrade to Personal Pro' : 'Start with a free account')
const teamCta = computed(() => isSignedIn.value ? 'Create a team' : 'Start a team free')

const interval = ref<BillingInterval>(DEFAULT_BILLING_INTERVAL)
const { price, monthlyEquivalent } = useSubscriptionPricing()
const hydrated = ref(false)

onMounted(() => {
  hydrated.value = true
})

const yearlySavingMonths = Math.round(
  12 - TEAM_PLAN.yearlyCentsPerSeat / TEAM_PLAN.monthlyCentsPerSeat
)

const highlights = {
  free: [
    'Unlimited event types',
    'Calendar connections and meeting links',
    'Booking confirmations and reminders',
    'Unlimited workflows and routing forms',
    'Paid bookings and core analytics'
  ],
  pro: [
    'Your logo and brand colours',
    'Remove Calendza branding',
    'Custom branded guest emails',
    'Revenue reports and CSV exports',
    'Lower fees on personal paid bookings'
  ],
  team: [
    'Shared booking pages and event types',
    'Round-robin and collective meetings',
    'Managed event templates',
    'Member roles and team activity',
    'Each host’s own availability and calendars'
  ]
}

const includedFeatures = [
  { title: 'Unlimited event types', detail: 'Your own booking page, with links for every meeting you offer.' },
  { title: 'Availability controls', detail: '10 schedules, date overrides, time zones, buffers and booking limits.' },
  { title: 'Booking essentials', detail: 'Questions, approvals, group bookings, reminders and rescheduling. Embed booking on your website.' },
  { title: 'Calendar and video integrations', detail: 'Connect your calendars and add Google Meet, Microsoft Teams or Zoom meeting links.' },
  { title: 'Unlimited workflows and routing forms', detail: 'Automate follow-ups and guide guests to the right booking page. Delivery safeguards apply.' },
  { title: 'Paid bookings and core analytics', detail: 'Collect payments and see your booking activity. Platform and payment-provider fees apply.' }
]

type Availability = boolean | string

interface ComparisonRow {
  label: string
  detail?: string
  free: Availability
  pro: Availability
  team: Availability
}

const comparison: { group: string, rows: ComparisonRow[] }[] = [
  {
    group: 'Branding and business',
    rows: [
      { label: 'Custom booking-page branding', detail: 'Your logo and colours, without Calendza branding.', free: false, pro: true, team: true },
      { label: 'Custom branded guest emails', free: false, pro: true, team: true },
      { label: 'Revenue reports and CSV exports', free: false, pro: true, team: true },
      { label: 'Paid-booking platform fee', detail: 'Personal booking fees for Free and Pro; team booking fees for Team. Provider fees are separate.', free: '5%', pro: '2.5%', team: '5%' }
    ]
  },
  {
    group: 'Scheduling together',
    rows: [
      { label: 'Team booking pages', detail: `Shared event types for up to ${TEAM_PLAN.maxSeats} members.`, free: false, pro: false, team: true },
      { label: 'Managed event templates', free: false, pro: false, team: true },
      {
        label: 'Round-robin assignment',
        detail: 'Distribute bookings across available teammates.',
        free: false, pro: false,
        team: true
      },
      {
        label: 'Collective meetings',
        detail: 'Offered only when every required host is free.',
        free: false, pro: false,
        team: true
      },
      { label: 'Team administration', detail: 'Member roles, permissions and activity history.', free: false, pro: false, team: true }
    ]
  }
]

const faqs = [
  {
    q: 'Why choose Personal Pro?',
    a: 'Free covers everyday scheduling. Pro adds your branding, custom guest emails and revenue reports, and lowers the platform fee on personal paid bookings from 5% to 2.5%. You pay for business features, not more booking links.'
  },
  {
    q: 'How does billing work?',
    a: 'Choose monthly or yearly billing, with two months free when paying yearly. Nigeria uses fixed naira prices and manual bank-transfer renewals. US dollar card subscriptions renew automatically until cancelled. Paid bookings use the currency chosen by the host.'
  },
  {
    q: 'How does the Team plan work?',
    a: `Share booking links, distribute meetings and manage your team’s events. You pay for joined members, including the owner; pending invitations cost nothing. Try it free for ${TEAM_PLAN.trialDays} days without a card. If unpaid after the ${TEAM_PLAN.graceDays}-day grace period, the team becomes read-only without deleting its data. Your personal free scheduling stays available.`
  },
  {
    q: 'What does unlimited mean?',
    a: `Create as many event types, workflows and routing forms as you need. Every plan has abuse safeguards: ${WORKFLOW_DELIVERY_PER_HOUR} workflow email or webhook attempts per hour per workspace, including retries, with excess actions queued. Built-in confirmations and reminders are separate. Configuration changes across these features are limited to ${CONFIGURATION_WRITES_PER_MINUTE} requests per minute per IP address.`
  }
]

useSeoMeta({
  title: 'Pricing',
  description: `Start scheduling free, upgrade to Personal Pro for ${formatUsd(PERSONAL_PRO_PLAN.monthlyCents)} a month, or run a team for ${formatUsd(TEAM_PLAN.monthlyCentsPerSeat)} per member.`,
  ogTitle: 'Calendza pricing',
  ogDescription: `Free personal scheduling, ${formatUsd(PERSONAL_PRO_PLAN.monthlyCents)} Personal Pro and fair per-member team pricing.`
})

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': 'Calendza',
      'url': `${origin}/pricing`,
      'description': 'Scheduling links with clear timezone handling, free for individuals and per member for teams.',
      'offers': [
        {
          '@type': 'Offer',
          'name': 'Personal Free',
          'price': '0',
          'priceCurrency': 'USD'
        },
        {
          '@type': 'Offer',
          'name': 'Personal Pro',
          'price': (PERSONAL_PRO_PLAN.monthlyCents / 100).toFixed(2),
          'priceCurrency': PERSONAL_PRO_PLAN.currency,
          'description': 'Per user, per month. Annual billing is available at a discount.'
        },
        {
          '@type': 'Offer',
          'name': 'Team',
          'price': (TEAM_PLAN.monthlyCentsPerSeat / 100).toFixed(2),
          'priceCurrency': TEAM_PLAN.currency,
          'description': 'Per member, per month, billed only for members who have joined.'
        }
      ]
    })
  }]
})
</script>

<template>
  <div :data-ready="hydrated">
    <section class="border-b border-default">
      <div class="mx-auto max-w-312 px-6 py-20 lg:px-10 lg:py-28">
        <p class="eyebrow text-dimmed">
          Pricing
        </p>
        <h1 class="mt-6 max-w-[18ch] font-editorial text-[clamp(2.5rem,6vw,4rem)] leading-[1.02] tracking-[-0.02em] text-highlighted">
          Free gets you booked.
        </h1>
        <p class="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-muted">
          Pro makes it your brand and helps you earn more from every booking.
          Keep scheduling free, or upgrade for custom branding, revenue reports and lower fees on paid bookings.
        </p>
      </div>
    </section>

    <section class="border-b border-default bg-muted">
      <div class="mx-auto max-w-312 px-6 py-16 lg:px-10 lg:py-20">
        <BillingRegionControl class="mb-8" />
        <!-- Sits with the cards, not up in the hero: the price above changes
             when this changes, so the control has to be next to what it moves. -->
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div
            class="inline-flex items-center gap-1 rounded-full border border-default bg-default p-1"
            role="group"
            aria-label="Billing period"
          >
            <button
              v-for="option in (['monthly', 'yearly'] as const)"
              :key="option"
              type="button"
              class="rounded-full px-4 py-2 text-[14px] font-medium transition-colors"
              :class="interval === option
                ? 'bg-primary text-inverted'
                : 'text-muted hover:text-highlighted'"
              :aria-pressed="interval === option"
              @click="interval = option"
            >
              {{ option === 'yearly' ? 'Yearly' : 'Monthly' }}
            </button>
          </div>

          <p
            v-if="interval === 'yearly'"
            class="text-[14px] text-muted"
          >
            {{ yearlySavingMonths }} months free, and one payment a year instead of twelve.
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-3">
          <article class="flex flex-col rounded-2xl border border-default bg-default p-7 lg:p-9">
            <p class="eyebrow text-dimmed">
              Personal Free
            </p>
            <p class="mt-6 font-editorial text-[3rem] leading-none tracking-[-0.02em] text-highlighted">
              Free
            </p>
            <p class="mt-3 text-[15px] text-muted">
              Forever, for one person. No card, no expiry.
            </p>
            <p class="mt-6 text-[16px] text-muted">
              Everything you need to get booked.
            </p>
            <ul class="my-6 space-y-3">
              <li
                v-for="feature in highlights.free"
                :key="feature"
                class="flex items-start gap-3 text-[15px] leading-relaxed text-toned"
              >
                <UIcon
                  name="i-lucide-check"
                  class="mt-1 size-4 shrink-0 text-primary"
                />
                <span>{{ feature }}</span>
              </li>
            </ul>
            <p class="mb-6 text-[14px] leading-relaxed text-muted">
              5% platform fee on paid bookings.
            </p>
            <UButton
              :to="accountDestination"
              prefetch
              size="xl"
              color="neutral"
              variant="outline"
              block
              class="mobile-compact-action mt-auto rounded-full text-center font-medium"
            >
              {{ personalCta }}
            </UButton>
          </article>

          <article class="relative flex flex-col rounded-2xl border-2 border-primary bg-default p-7 lg:p-9">
            <span class="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold tracking-wide text-inverted">
              Best for professionals
            </span>
            <p class="eyebrow text-primary">
              Personal Pro
            </p>
            <p class="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-2 font-editorial text-[3rem] leading-none tracking-[-0.02em] text-highlighted">
              <span>{{ price('personal', interval) }}</span>
              <span class="whitespace-nowrap font-sans text-[16px] tracking-normal text-muted">/ {{ interval === 'yearly' ? 'year' : 'month' }}</span>
            </p>
            <p class="mt-3 text-[15px] text-muted">
              <template v-if="interval === 'yearly'">
                One annual payment, equivalent to {{ monthlyEquivalent('personal') }} a month.
              </template>
              <template v-else>
                One payment each month.
              </template>
            </p>
            <p class="mt-6 text-[16px] text-muted">
              Everything in Free, made your own.
            </p>
            <ul class="my-6 space-y-3">
              <li
                v-for="feature in highlights.pro"
                :key="feature"
                class="flex items-start gap-3 text-[15px] leading-relaxed text-toned"
              >
                <UIcon
                  name="i-lucide-check"
                  class="mt-1 size-4 shrink-0 text-primary"
                />
                <span>{{ feature }}</span>
              </li>
            </ul>
            <p class="mb-6 text-[14px] leading-relaxed text-muted">
              2.5% platform fee on personal paid bookings, instead of 5%.
            </p>
            <UButton
              :to="proDestination"
              prefetch
              size="xl"
              block
              class="mobile-compact-action mt-auto rounded-full text-center font-medium"
            >
              {{ proCta }}
            </UButton>
          </article>

          <article class="flex flex-col rounded-2xl border border-default bg-default p-7 lg:p-9">
            <p class="eyebrow text-dimmed">
              Team
            </p>
            <p class="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-2 font-editorial text-[3rem] leading-none tracking-[-0.02em] text-highlighted">
              <span>{{ price('team', interval) }}</span>
              <span class="whitespace-nowrap font-sans text-[16px] tracking-normal text-muted">
                per member / {{ interval === 'yearly' ? 'year' : 'month' }}
              </span>
            </p>
            <p class="mt-3 text-[15px] text-muted">
              <template v-if="interval === 'yearly'">
                One annual payment, equivalent to {{ monthlyEquivalent('team') }} a month.
              </template>
              <template v-else>
                One payment each month.
              </template>
            </p>
            <p class="mt-6 text-[16px] text-muted">
              Bring everyone’s scheduling together.
            </p>
            <ul class="my-6 space-y-3">
              <li
                v-for="feature in highlights.team"
                :key="feature"
                class="flex items-start gap-3 text-[15px] leading-relaxed text-toned"
              >
                <UIcon
                  name="i-lucide-check"
                  class="mt-1 size-4 shrink-0 text-primary"
                />
                <span>{{ feature }}</span>
              </li>
            </ul>
            <p class="mb-6 text-[14px] leading-relaxed text-muted">
              {{ TEAM_PLAN.trialDays }} days free, no card needed.
              5% platform fee on team paid bookings.
            </p>
            <UButton
              :to="teamDestination"
              prefetch
              size="xl"
              block
              class="mobile-compact-action mt-auto rounded-full text-center font-medium"
            >
              {{ teamCta }}
            </UButton>
          </article>
        </div>
        <p class="mt-6 text-center text-[14px] leading-relaxed text-muted">
          Payment-provider fees are separate from Calendza’s platform fee.
        </p>
      </div>
    </section>

    <section class="border-b border-default">
      <div class="mx-auto max-w-312 px-6 py-16 lg:px-10 lg:py-20">
        <h2 class="font-editorial text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-highlighted">
          Included in every plan
        </h2>
        <dl class="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="feature in includedFeatures"
            :key="feature.title"
          >
            <dt class="text-[16px] font-semibold text-highlighted">
              {{ feature.title }}
            </dt>
            <dd class="mt-2 text-[14px] leading-relaxed text-muted">
              {{ feature.detail }}
            </dd>
          </div>
        </dl>
        <p class="mb-8 mt-6 text-[14px] text-muted">
          Looking for a specific capability?
          <NuxtLink
            to="/features"
            class="text-primary underline underline-offset-4"
          >
            Explore Calendza’s features
          </NuxtLink>
        </p>
        <details class="group overflow-hidden rounded-2xl border border-default bg-default">
          <summary class="surface-secondary flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
            <h2 class="text-[18px] font-semibold text-highlighted">
              Compare plans
            </h2>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-5 shrink-0 text-dimmed transition-transform group-open:rotate-180"
            />
          </summary>
          <p class="px-5 pt-5 text-[14px] leading-relaxed text-muted sm:px-6">
            Every plan includes the essentials above. Here’s what changes when you upgrade.
          </p>
          <p class="px-5 pt-5 text-[14px] text-muted sm:hidden">
            Scroll each table sideways to compare plans.
          </p>
          <section
            v-for="section in comparison"
            :key="section.group"
            class="border-b border-default last:border-b-0"
          >
            <h3 class="px-5 pb-2 pt-6 text-[16px] font-semibold text-highlighted sm:px-6">
              {{ section.group }}
            </h3>

            <div
              tabindex="0"
              role="region"
              :aria-label="`${section.group} plan comparison`"
              class="overflow-x-auto px-5 pb-3 sm:px-6"
            >
              <table class="w-full min-w-176 border-collapse text-left">
                <thead>
                  <tr class="border-b border-default">
                    <th class="py-3 pr-4 text-[14px] font-medium text-muted">
                      Feature
                    </th>
                    <th class="w-32 py-3 text-[14px] font-medium text-muted">
                      Free
                    </th>
                    <th class="w-32 py-3 text-[14px] font-medium text-muted">
                      Personal Pro
                    </th>
                    <th class="w-40 py-3 text-[14px] font-medium text-muted">
                      Team
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in section.rows"
                    :key="row.label"
                    class="border-b border-default"
                  >
                    <td class="py-4 pr-4 align-top">
                      <p class="text-[16px] text-highlighted">
                        {{ row.label }}
                      </p>
                      <p
                        v-if="row.detail"
                        class="mt-0.5 text-[14px] leading-relaxed text-muted"
                      >
                        {{ row.detail }}
                      </p>
                    </td>
                    <td
                      v-for="plan in (['free', 'pro', 'team'] as const)"
                      :key="plan"
                      class="relative py-4 align-top"
                    >
                      <template v-if="typeof row[plan] === 'string'">
                        <span class="text-[15px] text-toned">{{ row[plan] }}</span>
                      </template>
                      <template v-else-if="row[plan]">
                        <UIcon
                          name="i-lucide-check"
                          class="size-4.5 text-primary"
                        />
                        <span class="sr-only">Included</span>
                      </template>
                      <template v-else>
                        <UIcon
                          name="i-lucide-minus"
                          class="size-4.5 text-dimmed"
                        />
                        <span class="sr-only">Not included</span>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </details>
      </div>
    </section>

    <section class="bg-muted">
      <div class="mx-auto max-w-312 px-6 py-16 lg:px-10 lg:py-20">
        <div class="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div class="lg:sticky lg:top-32 lg:self-start">
            <h2 class="font-editorial text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-highlighted">
              Questions worth asking
            </h2>
          </div>

          <dl class="divide-y divide-default border-y border-default">
            <div
              v-for="faq in faqs"
              :key="faq.q"
              class="py-7"
            >
              <dt class="text-[17px] font-semibold tracking-tight text-highlighted">
                {{ faq.q }}
              </dt>
              <dd class="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-muted">
                {{ faq.a }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  </div>
</template>
