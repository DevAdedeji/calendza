<script setup lang="ts">
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'
import { apiErrorMessage } from '@/services/api/http'

const { currency, setCurrency, signedIn, initialized } = useSubscriptionPricing()
const saving = ref(false)
const error = ref('')

async function changeCurrency(value: string) {
  if (value !== 'NGN' && value !== 'USD') return
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await setCurrency(value)
  } catch (failure) {
    error.value = apiErrorMessage(failure, 'Could not change currency. Please try again.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <UFormField
      label="Currency"
      class="ml-auto w-64 max-w-full"
    >
      <USelect
        :model-value="currency"
        :items="[{ label: 'Nigerian naira (NGN)', value: 'NGN' }, { label: 'US dollar (USD)', value: 'USD' }]"
        :disabled="!initialized || saving"
        value-key="value"
        class="w-full"
        @update:model-value="changeCurrency"
      />
    </UFormField>
    <p
      v-if="signedIn"
      class="text-right text-xs text-muted"
    >
      Saved to your account. Existing subscriptions are unchanged.
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-right text-sm text-error"
    >
      {{ error }}
    </p>
    <p
      v-if="!initialized"
      role="status"
      class="text-right text-sm text-muted"
    >
      Loading prices…
    </p>
  </div>
</template>
