<script setup lang="ts">
import { useSubscriptionPricing } from '@/composables/billing/useSubscriptionPricing'

const { currency, initialized } = useSubscriptionPricing()
</script>

<template>
  <div class="flex flex-col items-end gap-2">
    <UFormField
      label="Billing region"
      class="ml-auto w-64 max-w-full"
    >
      <USelect
        v-model="currency"
        :items="[{ label: 'Nigeria (NGN)', value: 'NGN' }, { label: 'Other countries (USD)', value: 'USD' }]"
        :disabled="!initialized"
        value-key="value"
        class="w-full"
      />
    </UFormField>
    <p
      v-if="!initialized"
      role="status"
      class="text-right text-sm text-muted"
    >
      Loading prices…
    </p>
  </div>
</template>
