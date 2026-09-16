<script setup lang="ts">
const useCases = [
  {
    title: 'Book client consultations',
    description: 'Let clients choose a discovery call or advisory session and book without the back-and-forth.',
    to: '/use-cases/consultants',
    icon: 'i-lucide-briefcase-business'
  },
  {
    title: 'Get paid for appointments',
    description: 'Set a session price and let clients book and pay in one flow.',
    to: '/use-cases/paid-appointments',
    icon: 'i-lucide-wallet-cards'
  },
  {
    title: 'Schedule as a team',
    description: 'Share one link that books an available teammate or finds time for everyone.',
    to: '/use-cases/team-scheduling',
    icon: 'i-lucide-users-round'
  }
]
</script>

<template>
  <section
    id="use-cases"
    class="border-y border-default bg-default"
  >
    <div class="mx-auto max-w-312 px-6 py-20 lg:px-10 lg:py-28">
      <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p class="eyebrow text-primary">
            Use cases
          </p>
          <h2 class="mt-5 max-w-[18ch] font-editorial text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-[-0.02em] text-highlighted">
            What would you like to book?
          </h2>
          <p class="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-muted">
            Three ways to use Calendza, with examples to help you get started.
          </p>
        </div>
        <NuxtLink
          to="/compare/calendly-alternative"
          class="group inline-flex items-center gap-2 text-[15px] font-semibold text-toned transition-colors hover:text-primary"
        >
          Looking for a Calendly alternative?
          <UIcon
            name="i-lucide-arrow-right"
            class="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </NuxtLink>
      </div>

      <div class="mt-12 grid gap-px overflow-hidden rounded-2xl border border-default bg-default md:grid-cols-3">
        <NuxtLink
          v-for="useCase in useCases"
          :key="useCase.to"
          :to="useCase.to"
          class="group surface-secondary min-h-64 p-7 transition-colors hover:bg-primary/5"
        >
          <span class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon
              :name="useCase.icon"
              class="size-5"
            />
          </span>
          <h3 class="mt-10 flex items-center justify-between gap-3 text-[17px] font-semibold text-highlighted">
            {{ useCase.title }}
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-4 text-dimmed transition group-hover:text-primary"
            />
          </h3>
          <p class="mt-3 text-[15px] leading-relaxed text-muted">
            {{ useCase.description }}
          </p>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
