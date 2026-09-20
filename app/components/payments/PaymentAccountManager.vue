<script setup lang="ts">
import { formatMoney, type PaymentCurrency } from '#shared/payments'
import { apiErrorMessage } from '@/services/api/http'
import { useAccountMoneyDisplay } from '@/composables/payments/useAccountMoneyDisplay'
import { paymentsApi, type PaymentAccountSummary, type PaymentSummary } from '@/services/api/payments'

const props = defineProps<{ teamSlug?: string }>()
const endpoint = computed(() => props.teamSlug
  ? paymentsApi.teamEndpoint(props.teamSlug)
  : paymentsApi.endpoint)
const route = useRoute()
const toast = useToast()

const { data, status, error, refresh } = await useFetch<PaymentAccountSummary>(endpoint)
const summaryEndpoint = computed(() => paymentsApi.summaryEndpoint(props.teamSlug))
const {
  data: summary,
  status: summaryStatus,
  error: summaryError,
  refresh: refreshSummary
} = await useLazyFetch<PaymentSummary>(summaryEndpoint)
const starting = ref(false)
const checking = ref(false)

const { currency: selectedCurrency, saveCurrency, total: amount, activeRates, refreshRates } = useAccountMoneyDisplay()
const currencyOptions: PaymentCurrency[] = ['NGN', 'USD']
const savingCurrency = ref(false)
const currencyError = ref('')
const needsConversion = computed(() => [
  ...(summary.value?.available ?? []), ...(summary.value?.pending ?? []), ...(summary.value?.collected ?? []), ...(summary.value?.withdrawn ?? [])
].some(total => total.amountCents !== 0 && total.currency !== selectedCurrency.value))
const currentRate = computed(() => activeRates.value.find(rate => rate.to === selectedCurrency.value))
const rateTime = computed(() => currentRate.value ? new Date(currentRate.value.quotedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
const hasNegativeBalance = computed(() => summary.value?.available.some(total => total.amountCents < 0))
async function changeCurrency(value: string) {
  if (savingCurrency.value || (value !== 'NGN' && value !== 'USD')) return
  savingCurrency.value = true
  currencyError.value = ''
  try {
    await saveCurrency(value)
  } catch (error) {
    currencyError.value = apiErrorMessage(error, 'Could not save your currency. Try again.')
  } finally {
    savingCurrency.value = false
  }
}

async function refreshMoney() {
  await Promise.all([refreshSummary(), refreshRates()])
}

const statusCopy = computed(() => ({
  not_started: ['Set up payouts', 'Complete Bachs’ secure setup once, including the bank account for your payouts.'],
  onboarding: ['Setup incomplete', 'Bachs reports that setup is incomplete. Finish its identity and bank-account steps before accepting paid bookings.'],
  pending_review: ['Under Bachs review', 'Your account or bank destination is still being reviewed. Paid bookings remain disabled.'],
  active: ['Paid bookings enabled', 'Bachs has enabled transfers and approved a usable payout destination. Funds still remain in Bachs until a separate withdrawal is created.'],
  restricted: ['Action required', 'Bachs needs updated information. Paid bookings remain disabled until the restriction is resolved.'],
  disabled: ['Payments unavailable', 'This payout account is disabled. Contact support if this was unexpected.'],
  unavailable: ['Status unavailable', 'Calendza could not verify this account with Bachs, so paid bookings are disabled for safety. Try checking again.']
} as const)[data.value?.status ?? 'not_started'])

const actionLabel = computed(() => data.value?.ready
  ? 'Manage in Bachs'
  : data.value?.configured ? 'Continue in Bachs' : 'Set up payouts')

const statusTone = computed(() => {
  if (data.value?.ready) return 'success' as const
  if (data.value?.status === 'pending_review' || data.value?.status === 'onboarding') return 'warning' as const
  if (data.value?.status === 'restricted' || data.value?.status === 'disabled' || data.value?.status === 'unavailable') return 'error' as const
  return 'neutral' as const
})

function takeNextAction() {
  void start()
}

async function start() {
  starting.value = true
  const setupWindow = window.open('about:blank', '_blank')
  if (setupWindow) setupWindow.opener = null
  try {
    const link = await paymentsApi.start(props.teamSlug)
    if (setupWindow) setupWindow.location.replace(link.url)
    else window.location.assign(link.url)
  } catch (failure) {
    setupWindow?.close()
    toast.add({ title: 'Could not open payment setup', description: apiErrorMessage(failure, 'Try again in a moment.'), color: 'error' })
  } finally {
    starting.value = false
  }
}

async function checkStatus(notify = true) {
  checking.value = true
  try {
    await refresh()
    if (!notify) return
    if (error.value) {
      toast.add({
        title: 'Could not check Bachs status',
        description: 'No payment setting was changed. Try again in a moment.',
        color: 'error'
      })
      return
    }
    const copy = ({
      onboarding: ['Setup is still incomplete', 'Finish the remaining steps in Bachs before enabling paid bookings.'],
      pending_review: ['Still under Bachs review', 'No action is needed unless Bachs asks for more information. Paid bookings remain disabled.'],
      active: ['Paid bookings are enabled', 'A separate withdrawal is still required to send settled funds from Bachs to the bank.'],
      restricted: ['Bachs needs more information', 'Open Bachs to review and resolve the account restriction.'],
      disabled: ['Payments are unavailable', 'Contact support if Bachs disabled this account unexpectedly.'],
      not_started: ['Payout setup has not started', 'Open Bachs to submit your payout details.'],
      unavailable: ['Could not verify payout status', 'Paid bookings remain disabled until Calendza can check Bachs again.']
    } as const)[data.value?.status ?? 'not_started']
    toast.add({ title: copy[0], description: copy[1], color: data.value?.ready ? 'success' : 'neutral' })
  } finally {
    checking.value = false
  }
}

async function checkSetupOnReturn() {
  if (document.visibilityState !== 'visible' || !data.value?.configured || data.value.ready) return
  await refresh()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', checkSetupOnReturn)
  if (route.query.payments === 'returned') {
    await checkStatus()
  } else if (route.query.payments === 'refresh') {
    await start()
  }
})

onBeforeUnmount(() => document.removeEventListener('visibilitychange', checkSetupOnReturn))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Payments"
      description="Accept payment when a guest books. Bachs settles your share into a connected balance; sending it to a bank is a separate withdrawal."
    />

    <section class="overflow-hidden rounded-2xl border border-default bg-default">
      <div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div class="flex min-w-0 gap-4">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon
              name="i-lucide-wallet-cards"
              class="size-5"
            />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-base font-semibold text-highlighted">
                Payout account
              </h2>
              <UBadge
                :color="statusTone"
                variant="subtle"
              >
                {{ statusCopy[0] }}
              </UBadge>
            </div>
            <p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              {{ statusCopy[1] }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <UButton
            v-if="data?.configured"
            label="Check status"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="checking || status === 'pending'"
            class="mobile-compact-action h-9 min-h-9"
            @click="checkStatus()"
          />
          <UButton
            v-if="data?.ready || data?.nextAction !== 'none'"
            :loading="starting"
            icon="i-lucide-external-link"
            class="mobile-compact-action h-9 min-h-9 text-center"
            @click="takeNextAction"
          >
            {{ actionLabel }}
          </UButton>
        </div>
      </div>
      <div
        v-if="data?.configured && !data.ready"
        class="flex gap-3 border-t border-warning/30 bg-warning/5 px-6 py-4 text-sm text-toned sm:px-7"
      >
        <UIcon
          name="i-lucide-shield-alert"
          class="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p>
          Calendza checks the account directly with Bachs and will not create a checkout until account setup, transfers and payouts are all approved.
        </p>
      </div>
      <div class="surface-secondary grid gap-px border-t border-default sm:grid-cols-2 lg:grid-cols-4">
        <div class="p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            Guest checkout
          </p>
          <p class="mt-2 text-sm text-toned">
            The listed event price is what the guest pays.
          </p>
        </div>
        <div class="p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            Calendza fee
          </p>
          <p class="mt-2 text-sm text-toned">
            {{ ((data?.platformFeeBps ?? 500) / 100).toFixed(2).replace(/\.00$/, '') }}% per paid booking.
          </p>
        </div>
        <div class="p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            Bachs processing
          </p>
          <p class="mt-2 text-sm text-toned">
            Deducted from the charge at the rate for the payment method used.
          </p>
        </div>
        <div class="p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed">
            Withdrawals
          </p>
          <p class="mt-2 text-sm text-toned">
            Booking proceeds stay in Bachs until a withdrawal is created for the approved bank destination.
          </p>
        </div>
      </div>
    </section>

    <AsyncErrorState
      v-if="error"
      title="Could not check your payout account"
      description="Your existing setup is safe. Try the health check again."
      :retrying="status === 'pending'"
      @retry="refresh"
    />

    <section
      class="overflow-hidden rounded-2xl border border-default bg-default"
      aria-labelledby="payment-summary-title"
    >
      <header class="flex flex-col gap-3 border-b border-default p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2
            id="payment-summary-title"
            class="text-base font-semibold text-highlighted"
          >
            Payment summary
          </h2>
          <p class="mt-1 text-sm text-muted">
            Your full balance and collections, displayed in your chosen currency.
          </p>
          <p
            v-if="needsConversion && currentRate"
            class="mt-1 text-xs text-muted"
          >
            ≈ Bachs estimate at {{ rateTime }}: 1 {{ currentRate.inverse ? currentRate.to : currentRate.from }} = {{ currentRate.rate }} {{ currentRate.inverse ? currentRate.from : currentRate.to }}. Withdrawal fees and final payout rates may differ.
          </p>
          <p
            v-else-if="needsConversion"
            role="status"
            class="mt-1 text-xs text-warning"
          >
            Bachs’ exchange rate is unavailable or expired. Refresh to retry; your original balances are unchanged.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <USelect
            :model-value="selectedCurrency"
            :disabled="savingCurrency"
            :items="currencyOptions"
            aria-label="Display currency"
            class="w-28"
            @update:model-value="changeCurrency"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            aria-label="Refresh payment summary"
            color="neutral"
            variant="ghost"
            :loading="summaryStatus === 'pending'"
            @click="refreshMoney"
          />
        </div>
      </header>
      <p
        v-if="currencyError"
        role="alert"
        class="px-6 py-3 text-sm text-error"
      >
        {{ currencyError }}
      </p>
      <p
        v-if="hasNegativeBalance"
        role="alert"
        class="border-b border-error/30 bg-error/5 px-5 py-3 text-sm text-error sm:px-6"
      >
        One of your currency balances is negative. Withdrawals are unavailable until it is resolved.
      </p>
      <div
        v-if="summaryStatus === 'pending' && !summary"
        class="grid gap-px surface-secondary sm:grid-cols-3"
        aria-label="Loading payment summary"
      >
        <div
          v-for="index in 3"
          :key="index"
          class="space-y-3 bg-default p-5 sm:p-6"
        >
          <USkeleton class="h-3 w-24" />
          <USkeleton class="h-7 w-32" />
        </div>
      </div>
      <AsyncErrorState
        v-else-if="summaryError"
        title="Could not load payment totals"
        description="Your payment records are safe. Try loading the summary again."
        :retrying="summaryStatus === 'pending'"
        @retry="refreshSummary"
      />
      <div
        v-else
        class="grid gap-px surface-secondary sm:grid-cols-3"
      >
        <div class="bg-default p-5 sm:p-6">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">
            Available balance
          </p>
          <p class="mt-3 text-xl font-semibold tabular-nums text-highlighted">
            {{ summary?.providerStatus === 'available' ? amount(summary.available, 'No settled funds') : 'Unavailable' }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Funds held in Bachs, ready to withdraw when your payout account is approved.
          </p>
        </div>
        <div class="bg-default p-5 sm:p-6">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">
            Pending settlement
          </p>
          <p class="mt-3 text-xl font-semibold tabular-nums text-highlighted">
            {{ summary?.providerStatus === 'available' ? amount(summary.pending, 'None pending') : 'Unavailable' }}
          </p>
          <p class="mt-2 text-xs text-muted">
            Payments still settling, shown in {{ selectedCurrency }}.
          </p>
        </div>
        <div class="bg-default p-5 sm:p-6">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">
            Total collected
          </p>
          <p class="mt-3 text-xl font-semibold tabular-nums text-highlighted">
            {{ amount(summary?.collected, 'No payments yet') }}
          </p>
          <p class="mt-2 text-xs text-muted">
            All successful bookings, before fees, shown in {{ selectedCurrency }}. Not your available balance.
          </p>
        </div>
      </div>
      <details
        v-if="summary?.providerStatus === 'available' && !summaryError"
        class="border-t border-default px-5 py-4 text-sm sm:px-6"
      >
        <summary class="cursor-pointer text-muted">
          Original balances held in Bachs
        </summary>
        <div class="mt-3 flex flex-wrap gap-4">
          <span
            v-for="total in summary.available.filter(total => total.amountCents !== 0)"
            :key="total.currency"
            class="tabular-nums"
          >
            {{ formatMoney(total.amountCents, total.currency) }}
          </span>
          <span
            v-if="!summary.available.some(total => total.amountCents !== 0)"
            class="text-muted"
          >No settled funds</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          Changing the display currency does not exchange or move your money.
        </p>
      </details>
    </section>

    <PaymentWithdrawalManager
      v-if="data?.configured"
      :key="teamSlug || 'personal'"
      :team-slug="teamSlug"
      @updated="refreshSummary"
    >
      <template #payout-summary>
        <USkeleton
          v-if="summaryStatus === 'pending' && !summary"
          class="h-10 w-48"
        />
        <p
          v-else-if="summaryError || summary?.providerStatus !== 'available'"
          class="text-sm text-muted"
        >
          Bank payout totals unavailable. Refresh the payment summary to try again.
        </p>
        <div
          v-else-if="summary?.withdrawn.some(total => total.amountCents !== 0)"
        >
          <div>
            <p class="text-xs text-muted">
              Total paid to your bank · {{ selectedCurrency }}
            </p>
            <p class="mt-1 font-semibold tabular-nums text-highlighted">
              {{ amount(summary?.withdrawn, 'No payouts yet') }}
            </p>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          No payouts yet
        </p>
      </template>
    </PaymentWithdrawalManager>

    <PaymentActivityList :team-slug="teamSlug" />
  </div>
</template>
