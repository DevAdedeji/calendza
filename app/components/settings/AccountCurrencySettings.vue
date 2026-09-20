<script setup lang="ts">
import type { PaymentCurrency } from '#shared/payments'
import { apiErrorMessage } from '@/services/api/http'

const { currency, user, saveCurrency } = useAccountCurrency()
const selected = ref<PaymentCurrency>(currency.value)
const saving = ref(false)
const error = ref('')
const feedback = useFeedback()
watch(currency, (value) => {
  selected.value = value
})

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await saveCurrency(selected.value)
    feedback.success({ title: 'Currency preference saved' })
  } catch (failure) {
    error.value = apiErrorMessage(failure, 'Could not save your currency. Please try again.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-default bg-default">
    <div class="border-b border-default px-6 py-5 sm:px-7">
      <h2 class="text-[16px] font-semibold text-highlighted">
        Currency
      </h2>
      <p class="mt-1 text-[14px] text-muted">
        Your default for prices, new paid events and money views, on every device.
      </p>
    </div>
    <form
      class="space-y-4 px-6 py-5 sm:px-7"
      @submit.prevent="save"
    >
      <UFormField
        label="Preferred currency"
        name="preferredCurrency"
      >
        <USelect
          v-model="selected"
          :items="[{ label: 'Nigerian naira (NGN)', value: 'NGN' }, { label: 'US dollar (USD)', value: 'USD' }]"
          :disabled="saving"
          class="w-full"
        />
      </UFormField>
      <p class="text-sm text-muted">
        Existing event prices, subscriptions and past payments keep their original currency. This does not convert balances.
      </p>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
      <UButton
        type="submit"
        :loading="saving"
        :disabled="selected === user?.preferredCurrency"
      >
        Save currency
      </UButton>
    </form>
  </section>
</template>
