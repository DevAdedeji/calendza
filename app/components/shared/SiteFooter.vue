<script setup lang="ts">
const columns = [
  {
    title: 'Use cases',
    links: [
      { label: 'Book client consultations', to: '/use-cases/consultants' },
      { label: 'Get paid for appointments', to: '/use-cases/paid-appointments' },
      { label: 'Schedule as a team', to: '/use-cases/team-scheduling' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Support', to: '/support' },
      { label: 'Zoom guide', to: '/docs/integrations/zoom' }
    ]
  }
]

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-default bg-muted">
    <div class="mx-auto max-w-312 px-6 lg:px-10">
      <div class="grid gap-10 py-12 sm:grid-cols-2 lg:flex lg:justify-between lg:gap-16 lg:py-16">
        <div class="sm:col-span-2 lg:col-span-1">
          <CalendzaMark />
          <p class="mt-5 max-w-[28ch] text-[16px] leading-relaxed text-muted">
            Share a link, get booked. More time for the work that matters.
          </p>
        </div>

        <div
          v-for="column in columns"
          :key="column.title"
        >
          <h3 class="eyebrow text-dimmed">
            {{ column.title }}
          </h3>
          <ul class="mt-5 space-y-3">
            <li
              v-for="link in column.links"
              :key="link.label"
            >
              <NuxtLink
                :to="link.to"
                class="text-[15px] text-muted transition-colors hover:text-highlighted"
              >{{ link.label }}</NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-default py-6 text-[14px] text-dimmed">
        <span>© {{ year }} Calendza</span>
        <nav
          aria-label="Legal"
          class="flex gap-6"
        >
          <NuxtLink
            to="/privacy"
            class="py-2 transition-colors hover:text-highlighted"
          >Privacy</NuxtLink>
          <NuxtLink
            to="/terms"
            class="py-2 transition-colors hover:text-highlighted"
          >Terms</NuxtLink>
        </nav>
      </div>
    </div>
  </footer>
</template>
