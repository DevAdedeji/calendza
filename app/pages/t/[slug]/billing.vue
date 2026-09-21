<script setup lang="ts">
import {
  billableSeats,
  DEFAULT_BILLING_INTERVAL,
  seatPriceCents,
  billingIntervals,
  billingCheckoutReason,
  invoiceTotalCents,
  type BillingInterval
} from '#shared/billing'
import { useAccountMoneyDisplay } from '@/composables/payments/useAccountMoneyDisplay'
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'
import { useBillingCheckout } from '@/composables/billing/useBillingCheckout'
import { apiErrorMessage } from '@/services/api/http'
import { billingApi, type TeamBillingResponse } from '@/services/api/billing'
import { formatInstant } from '@/utils/date-time'

definePageMeta({ layout: 'app', middleware: 'auth' })
useSeoMeta({ title: 'Team billing', robots: 'noindex, nofollow' })

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const feedback = useFeedback()
const { invoiceAmount: formatInvoiceAmount, money: formatSubscriptionMoney } = useAccountMoneyDisplay()

const { data, refresh, status, error: loadFailure }
  = await useLazyFetch<TeamBillingResponse>(() => billingApi.summaryEndpoint(slug.value))

const entitlement = computed(() => data.value?.entitlement)
const invoices = computed(() => data.value?.invoices ?? [])
const seatBilling = computed(() => data.value?.seatBilling)
const { initialLoading } = useListLoadingState(status, data)
const seatMismatch = computed(() => Boolean(
  entitlement.value
  && (seatBilling.value?.billedSeats ?? 0) !== entitlement.value.seatsUsed
))
const automaticSeatBilling = computed(() => seatBilling.value?.collectionMethod === 'charge_automatically')
const seatSyncActive = computed(() => ['pending', 'processing'].includes(seatBilling.value?.syncStatus ?? ''))
const checkoutReason = computed(() => {
  if (!entitlement.value || !seatBilling.value) return null
  return billingCheckoutReason(
    entitlement.value.status,
    seatBilling.value.collectionMethod,
    seatMismatch.value
  )
})
const checkoutLabel = computed(() => {
  if (checkoutReason.value === 'restart') return 'Start a new subscription'
  if (checkoutReason.value === 'manual_seat_change') return 'Update billing for current members'
  if (checkoutReason.value === 'manual_renewal') return 'Pay outstanding invoice'
  return 'Pay and activate'
})

const interval = ref<BillingInterval>(DEFAULT_BILLING_INTERVAL)
const { currency, ready: pricingReady, price } = useSubscriptionPricing()
const {
  open: openCheckout, close: closeCheckout, isLoading: starting, disabled: checkoutDisabled,
  message: checkoutMessage, error: checkoutError, fallbackUrl, refreshing: checkingPayment, refreshStatus
} = useBillingCheckout({
  selection: () => `${slug.value}:${currency.value}:${interval.value}:${entitlement.value?.seatsUsed}`,
  createSession: () => billingApi.checkout(slug.value, { interval: interval.value, currency: currency.value }),
  refresh: async () => {
    await refresh()
    if (loadFailure.value) throw loadFailure.value
    await refreshNuxtData('current-user')
  }
})
const retryingSeatSync = ref(false)

watch(entitlement, (value) => {
  if (value && value.status !== 'trialing') interval.value = value.interval
}, { immediate: true })

const intervalOptions = billingIntervals.map(value => ({
  label: value === 'yearly' ? 'Yearly — two months free' : 'Monthly',
  value
}))
const seats = computed(() => entitlement.value?.seatsUsed ?? 0)
// What the picker currently adds up to, used for the checkout button.
const total = computed(() => invoiceTotalCents(seats.value, interval.value))

// Keep the subscription amount intact; the UI may show its estimated equivalent
// without changing what the existing subscription will actually charge.
const headlineCents = computed(() => entitlement.value?.nextInvoiceCents ?? total.value)
const headlinePeriod = computed(() => (hasBillingHistory.value ? entitlement.value?.interval : interval.value) === 'monthly' ? 'month' : 'year')
const perSeatCents = computed(() => seatPriceCents(entitlement.value?.interval ?? 'yearly'))
const billedSeats = computed(() => billableSeats(seats.value))

const payingByCard = computed(() => seatBilling.value?.collectionMethod === 'charge_automatically')

/**
 * Until a payment succeeds there is no chosen method — the columns still hold
 * their database defaults, which would otherwise render as a method the team
 * never picked (and as impossible pairings like bank transfer in USD).
 */
const hasBillingHistory = computed(() => Boolean(
  seatBilling.value?.billedSeats != null || invoices.value.some(invoice => invoice.status === 'paid')
))
const lastPaidInvoice = computed(() => invoices.value.find(invoice => invoice.status === 'paid'))
const existingNairaBilling = computed(() => hasBillingHistory.value && seatBilling.value?.collectionCurrency === 'NGN')
const headline = computed(() => {
  if (!hasBillingHistory.value) return price('team', interval.value, billedSeats.value)
  if (existingNairaBilling.value) return lastPaidInvoice.value ? formatInvoiceAmount(lastPaidInvoice.value) : 'Amount unavailable'
  return formatSubscriptionMoney(headlineCents.value, 'USD')
})

const paymentMethod = computed(() => payingByCard.value
  ? {
      label: `Card · ${seatBilling.value?.collectionCurrency ?? 'USD'}`,
      detail: 'Renews on its own each period',
      icon: 'i-lucide-credit-card'
    }
  : {
      label: `Bank transfer · ${seatBilling.value?.collectionCurrency ?? 'NGN'}`,
      detail: 'Invoiced each period — nothing is charged automatically',
      icon: 'i-lucide-landmark'
    })

// Status colours always ship with a word and an icon, never colour alone.
const statusTone = computed(() => {
  const status = entitlement.value?.status
  if (status === 'active') return { color: 'success' as const, icon: 'i-lucide-circle-check', label: 'Active' }
  if (status === 'trialing') return { color: 'info' as const, icon: 'i-lucide-sparkles', label: 'Trialing' }
  if (status === 'past_due') return { color: 'warning' as const, icon: 'i-lucide-clock-alert', label: 'Past due' }
  if (status === 'paused') return { color: 'warning' as const, icon: 'i-lucide-circle-pause', label: 'Paused' }
  if (status === 'unpaid') return { color: 'error' as const, icon: 'i-lucide-circle-alert', label: 'Unpaid' }
  return { color: 'neutral' as const, icon: 'i-lucide-circle-minus', label: 'Canceled' }
})

const nextEvent = computed(() => {
  const value = entitlement.value
  if (!value) return null
  if (value.status === 'trialing') {
    return { label: 'Trial ends', value: value.trialEndsAt ? formatDate(value.trialEndsAt) : '—' }
  }
  if (!value.currentPeriodEnd) return null
  return {
    label: value.autoRenews ? 'Renews on' : 'Paid through',
    value: formatDate(value.currentPeriodEnd)
  }
})

// Bachs confirms payment by webhook; this redirect only tells us to re-read.
const paidJustNow = computed(() => route.query.paid === '1')

watch(paidJustNow, async (paid) => {
  if (!paid) return
  await refresh()
}, { immediate: true })

async function startCheckout() {
  if (!checkoutReason.value || !pricingReady.value || !data.value?.configured) return
  await openCheckout()
}

async function retrySeatSync() {
  if (retryingSeatSync.value) return
  retryingSeatSync.value = true
  try {
    await billingApi.syncSeats(slug.value)
    feedback.success({
      title: 'Seat billing queued',
      description: 'We are checking the subscription against your active members now.'
    })
    await new Promise(resolve => setTimeout(resolve, 1500))
    await refresh()
  } catch (failure) {
    feedback.error({
      title: 'Could not retry seat billing',
      description: apiErrorMessage(failure, 'Please try again shortly.')
    })
  } finally {
    retryingSeatSync.value = false
  }
}

function formatDate(iso: string) {
  return formatInstant(iso, { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusColor: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  expired: 'neutral'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Billing"
      description="Plan, payment method and invoice history for this team."
    />
    <SandboxPaymentNotice />
    <BillingCheckoutNotice
      :message="checkoutMessage"
      :error="checkoutError"
      :fallback-url="fallbackUrl"
      :refreshing="checkingPayment"
      @refresh="refreshStatus"
      @leave="closeCheckout"
    />

    <div
      v-if="paidJustNow"
      class="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3"
      role="status"
    >
      <UIcon
        name="i-lucide-circle-check"
        class="size-4 shrink-0 text-success"
      />
      <p class="text-[14px] text-muted">
        Payment received. If the status below still says pending, it will settle within a moment —
        we confirm from Bachs directly, never from this redirect.
      </p>
    </div>

    <AsyncErrorState
      v-if="loadFailure && !data"
      title="Could not load billing"
      description="Only an owner can view this."
      @retry="refresh"
    />

    <ListLoadingSkeleton
      v-else-if="initialLoading"
      label="Loading billing"
    />

    <template v-else-if="entitlement">
      <div
        v-if="!data?.configured"
        class="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p class="text-[14px] leading-relaxed text-muted">
          Billing is not configured on this environment, so checkout is unavailable.
          Set <code class="text-[13px]">BACHS_SECRET_KEY</code> and
          <code class="text-[13px]">BACHS_WEBHOOK_SECRET</code> to enable it.
        </p>
      </div>

      <div
        v-if="entitlement.status === 'active' && automaticSeatBilling && (seatMismatch || seatSyncActive || seatBilling?.syncStatus === 'failed')"
        class="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
        :class="seatBilling?.syncStatus === 'failed' ? 'border-error/30 bg-error/5' : 'border-info/30 bg-info/5'"
        :role="seatBilling?.syncStatus === 'failed' ? 'alert' : 'status'"
      >
        <UIcon
          :name="seatBilling?.syncStatus === 'failed' ? 'i-lucide-circle-alert' : 'i-lucide-refresh-cw'"
          class="size-4 shrink-0"
          :class="seatBilling?.syncStatus === 'failed' ? 'text-error' : 'text-info'"
        />
        <p class="min-w-0 flex-1 text-[14px] text-muted">
          <template v-if="seatBilling?.syncStatus === 'failed'">
            We could not update the subscription for {{ entitlement.seatsUsed }} active
            {{ entitlement.seatsUsed === 1 ? 'member' : 'members' }}. No change has been hidden;
            retry after checking the Bachs connection.
          </template>
          <template v-else>
            Updating the subscription to {{ entitlement.seatsUsed }}
            {{ entitlement.seatsUsed === 1 ? 'seat' : 'seats' }}. Bachs will charge only the
            prorated difference for the time remaining in this billing period.
          </template>
        </p>
        <UButton
          v-if="seatBilling?.syncStatus === 'failed'"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="retryingSeatSync"
          @click="retrySeatSync"
        >
          Try again
        </UButton>
      </div>

      <div
        v-if="entitlement.status === 'active' && !automaticSeatBilling && seatMismatch"
        class="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3"
        role="status"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p class="text-[14px] leading-relaxed text-muted">
          This team now has {{ entitlement.seatsUsed }} active members, but the last paid invoice
          covered {{ seatBilling?.billedSeats ?? 0 }}. Bank transfers cannot be charged automatically;
          start checkout below to update the paid term for the current team size.
        </p>
      </div>

      <section class="overflow-hidden rounded-2xl border border-default bg-default">
        <div class="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <UIcon
                :name="statusTone.icon"
                class="size-4"
                :class="{
                  'text-success': statusTone.color === 'success',
                  'text-info': statusTone.color === 'info',
                  'text-warning': statusTone.color === 'warning',
                  'text-error': statusTone.color === 'error',
                  'text-dimmed': statusTone.color === 'neutral'
                }"
              />
              <span class="text-[13px] font-medium text-toned">{{ statusTone.label }}</span>
              <span
                v-if="entitlement.status === 'trialing' && entitlement.daysLeftInTrial !== null"
                class="text-[13px] text-muted"
              >· {{ entitlement.daysLeftInTrial }} days left</span>
            </div>

            <!-- The one number this page leads with. Proportional figures: at this
                 size tabular digits read loose. -->
            <p
              v-if="existingNairaBilling"
              class="mt-3 text-sm text-muted"
            >
              Last paid invoice
            </p>
            <p class="mt-3 flex flex-wrap items-baseline gap-1.5">
              <span class="break-words text-[clamp(1.75rem,5vw,2.75rem)] font-semibold leading-none tracking-[-0.02em] text-highlighted">
                {{ headline }}
              </span>
              <span
                v-if="!existingNairaBilling"
                class="text-[15px] text-muted"
              >/{{ headlinePeriod }}</span>
            </p>

            <p class="mt-3 text-[14px] leading-relaxed text-muted">
              {{ billedSeats }} {{ billedSeats === 1 ? 'member' : 'members' }}<template v-if="!existingNairaBilling">
                × {{ hasBillingHistory ? formatSubscriptionMoney(perSeatCents, 'USD') : price('team', interval) }}/{{ headlinePeriod }}
              </template><template v-if="billedSeats !== seats">
                — billed at the {{ billedSeats }}-member minimum
              </template>.
              Only members who have joined are counted.
            </p>
            <p
              v-if="hasBillingHistory"
              class="mt-2 text-sm text-muted"
            >
              ≈ is a display estimate at Bachs’ rate. Your existing subscription is still charged in {{ seatBilling?.collectionCurrency }}; past invoices are unchanged.
              Your preferred currency is used for the display and new checkouts, not to change an existing subscription.
            </p>

            <p
              v-if="entitlement.status === 'past_due'"
              class="mt-3 text-[14px] leading-relaxed text-muted"
            >
              A payment failed. It is being retried automatically and the team keeps working meanwhile.
            </p>
            <p
              v-else-if="entitlement.status === 'unpaid'"
              class="mt-3 text-[14px] leading-relaxed text-muted"
            >
              Payment retries are exhausted, so the team is read-only. Paying below restores it immediately.
            </p>
            <p
              v-else-if="entitlement.readOnly"
              class="mt-3 text-[14px] leading-relaxed text-muted"
            >
              This team is read-only. Team booking pages are not taking new bookings until an invoice is paid.
            </p>
          </div>

          <dl class="grid h-fit gap-px self-start overflow-hidden rounded-xl border border-default bg-border sm:grid-cols-2 lg:grid-cols-1">
            <div
              v-if="nextEvent"
              class="bg-default px-4 py-3.5"
            >
              <dt class="text-[12px] font-medium uppercase tracking-wide text-dimmed">
                {{ nextEvent.label }}
              </dt>
              <dd class="mt-1 text-[15px] font-medium text-highlighted">
                {{ nextEvent.value }}
              </dd>
            </div>
            <div
              v-if="hasBillingHistory"
              class="bg-default px-4 py-3.5"
            >
              <dt class="text-[12px] font-medium uppercase tracking-wide text-dimmed">
                Paying with
              </dt>
              <dd class="mt-1 flex items-start gap-2">
                <UIcon
                  :name="paymentMethod.icon"
                  class="mt-0.5 size-3.5 shrink-0 text-dimmed"
                />
                <span class="min-w-0">
                  <span class="block text-[15px] font-medium text-highlighted">{{ paymentMethod.label }}</span>
                  <span class="mt-0.5 block text-[12px] leading-snug text-muted">{{ paymentMethod.detail }}</span>
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Only rendered when there is something to do. A healthy auto-renewing
             plan already says everything it needs to above. -->
        <div
          v-if="checkoutReason || (automaticSeatBilling && ['past_due', 'unpaid', 'paused'].includes(entitlement.status))"
          class="space-y-6 border-t border-default px-5 py-5 sm:px-6 sm:py-6"
        >
          <div
            v-if="checkoutReason"
            class="space-y-5 rounded-xl border border-default bg-muted/30 p-4 sm:p-5"
          >
            <div>
              <h3 class="text-[15px] font-semibold text-highlighted">
                Choose how to pay
              </h3>
              <p class="mt-1 text-[13px] text-muted">
                Review the billing period and payment method before opening secure checkout.
              </p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Billing period">
                <USelectMenu
                  v-model="interval"
                  :items="intervalOptions"
                  :disabled="checkoutDisabled"
                  value-key="value"
                  size="lg"
                  class="w-full"
                />
              </UFormField>
              <BillingRegionControl :disabled="checkoutDisabled" />
            </div>
            <UButton
              size="lg"
              block
              :loading="starting"
              :disabled="!data?.configured || !pricingReady || checkoutDisabled"
              @click="startCheckout"
            >
              {{ checkoutLabel }} · {{ price('team', interval, billedSeats) }}
            </UButton>
          </div>

          <div
            v-else
            class="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3"
            role="status"
          >
            <UIcon
              name="i-lucide-mail-warning"
              class="mt-0.5 size-4 shrink-0 text-warning"
            />
            <p class="text-[14px] leading-relaxed text-muted">
              Bachs is managing this payment issue. Use the secure payment-update link sent to
              the billing email instead of starting a second subscription.
            </p>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-default bg-default">
        <header class="flex items-center justify-between gap-3 border-b border-default px-5 py-4 sm:px-6">
          <div>
            <h2 class="text-[15px] font-semibold text-highlighted">
              Invoice history
            </h2>
            <p class="mt-1 text-[13px] text-muted">
              A record of attempted and completed team payments.
            </p>
          </div>
          <span class="tnum rounded-lg bg-muted px-2 py-1 text-[12px] text-muted">
            {{ invoices.length }}
          </span>
        </header>

        <ListEmptyState
          v-if="!invoices.length"
          icon="i-lucide-receipt"
          title="No invoices yet"
          description="Your first invoice appears here once you start a subscription."
        />

        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="invoice in invoices"
            :key="invoice.id"
            class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[1fr_auto_6.5rem] sm:px-6"
          >
            <div class="min-w-0">
              <p class="truncate text-[14px] text-highlighted">
                {{ formatDate(invoice.periodStart) }} – {{ formatDate(invoice.periodEnd) }}
              </p>
              <p class="mt-0.5 text-[12px] text-muted">
                {{ invoice.seats }} {{ invoice.seats === 1 ? 'member' : 'members' }} · {{ invoice.interval }}
                <template v-if="invoice.collectionCurrency !== 'USD'">
                  · charged in {{ invoice.collectionCurrency }}
                </template>
              </p>
            </div>

            <!-- A column of figures, so these get tabular digits to align. -->
            <p class="tnum text-right text-[15px] font-medium text-highlighted">
              {{ formatInvoiceAmount(invoice) }}
            </p>

            <div class="col-span-2 sm:col-span-1 sm:justify-self-end">
              <UBadge
                :color="statusColor[invoice.status] ?? 'neutral'"
                variant="subtle"
                size="sm"
                class="capitalize"
              >
                {{ invoice.status }}
              </UBadge>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
