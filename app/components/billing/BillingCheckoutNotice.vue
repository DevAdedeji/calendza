<script setup lang="ts">
defineProps<{
  message: string
  error: string
  fallbackUrl: string | null
  refreshing: boolean
  confirming: boolean
}>()
defineEmits<{ refresh: [], leave: [], stop: [] }>()
</script>

<template>
  <div
    v-if="message || error || fallbackUrl"
    class="space-y-2 rounded-xl border border-default bg-muted/30 p-4"
  >
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="text-sm text-muted"
    >
      {{ message }}
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <a
        v-if="fallbackUrl"
        :href="fallbackUrl"
        rel="noreferrer"
        class="text-sm font-medium text-primary underline underline-offset-4"
        @click="$emit('leave')"
      >Continue on secure checkout page</a>
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        :loading="refreshing"
        @click="$emit('refresh')"
      >
        Check again
      </UButton>
      <UButton
        v-if="confirming"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="$emit('stop')"
      >
        Stop checking
      </UButton>
    </div>
  </div>
</template>
