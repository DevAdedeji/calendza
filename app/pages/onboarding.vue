<script setup lang="ts">
import { onboardingApi, type FirstBookingSetup as FirstBookingSetupData } from '@/services/api/onboarding'

definePageMeta({ layout: false, middleware: 'auth' })
useSeoMeta({ title: 'Create your first event type', robots: 'noindex, nofollow' })

const { data: currentUser } = await useCurrentUser()
const { data, error, status, refresh } = await useFetch<FirstBookingSetupData | null>(onboardingApi.endpoint)
</script>

<template>
  <div class="min-h-screen bg-muted">
    <header class="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
      <NuxtLink
        to="/"
        aria-label="Calendza home"
      >
        <CalendzaMark />
      </NuxtLink>
      <UColorModeButton />
    </header>
    <main class="mx-auto max-w-2xl px-5 pb-16 pt-5 sm:pt-10">
      <AsyncErrorState
        v-if="error"
        title="Could not load your booking setup"
        description="Your account is safe. Try loading the setup again."
        :retrying="status === 'pending'"
        @retry="refresh()"
      />
      <FirstBookingSetup
        v-else-if="data && currentUser?.user"
        :setup="data"
        :username="currentUser.user.username"
      />
      <div
        v-else
        class="rounded-2xl border border-default bg-default p-8"
      >
        <h1 class="text-xl font-semibold text-highlighted">
          Your booking links are in Event types.
        </h1>
        <p class="mt-3 text-muted">
          You can create or edit your event types from your dashboard.
        </p>
        <UButton
          to="/event-types"
          class="mt-6"
        >
          Go to Event types
        </UButton>
      </div>
    </main>
  </div>
</template>
