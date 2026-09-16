<script setup lang="ts">
const links = [
  { label: 'Features', to: '/features' },
  {
    label: 'Use cases',
    children: [
      { label: 'Book client consultations', description: 'Turn the back-and-forth into a booked call.', icon: 'i-lucide-messages-square', to: '/use-cases/consultants' },
      { label: 'Get paid for appointments', description: 'Let clients book and pay in one flow.', icon: 'i-lucide-wallet-cards', to: '/use-cases/paid-appointments' },
      { label: 'Schedule as a team', description: 'Find the right teammate or a time for everyone.', icon: 'i-lucide-users-round', to: '/use-cases/team-scheduling' }
    ]
  },
  { label: 'Pricing', to: '/pricing' }
]

const open = ref(false)
const activeMenu = ref('')
const route = useRoute()
const colorMode = useColorMode()
const colorModeReady = ref(false)
const isDark = computed(() => colorModeReady.value && colorMode.value === 'dark')
const { isSignedIn, accountDestination } = await useLandingNavigation()

watch(() => route.fullPath, () => {
  open.value = false
  activeMenu.value = ''
})

onMounted(() => {
  // The saved preference only exists in the browser. Keep the first client
  // render identical to SSR, then reveal the resolved icon after hydration.
  colorModeReady.value = true
})

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-default bg-muted/85 backdrop-blur-md">
    <div class="mx-auto max-w-312 px-6 lg:px-10">
      <div class="flex h-16 items-center justify-between gap-8">
        <NuxtLink
          to="/"
          aria-label="Calendza home"
        >
          <CalendzaMark />
        </NuxtLink>

        <UNavigationMenu
          v-model="activeMenu"
          :items="links"
          :delay-duration="150"
          variant="link"
          aria-label="Main"
          class="hidden md:flex"
          :ui="{
            list: 'gap-4',
            link: 'text-[15px] font-normal',
            viewportWrapper: 'start-1/2 -translate-x-1/2 w-[28rem]',
            viewport: 'rounded-2xl shadow-xl',
            childList: 'grid-cols-1 gap-1 p-3',
            childLink: 'items-center gap-4 rounded-xl p-4 hover:bg-primary/5',
            childLinkIcon: 'size-6 text-primary group-hover:text-primary',
            childLinkLabel: 'whitespace-normal text-[15px] font-semibold',
            childLinkDescription: 'mt-1 text-sm leading-relaxed'
          }"
        />

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            class="size-11 justify-center"
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleColorMode"
          />
          <UButton
            :to="accountDestination"
            prefetch
            size="sm"
            class="hidden rounded-full px-4 font-medium sm:inline-flex"
          >
            {{ isSignedIn ? 'Dashboard' : 'Sign up free' }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            class="size-11 justify-center md:hidden"
            :icon="open ? 'i-lucide-x' : 'i-lucide-menu'"
            :aria-expanded="open"
            aria-label="Toggle navigation"
            @click="open = !open"
          />
        </div>
      </div>

      <nav
        v-if="open"
        aria-label="Mobile"
        class="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-default py-3 md:hidden"
      >
        <template
          v-for="link in links"
          :key="link.label"
        >
          <details
            v-if="link.children"
            class="group"
          >
            <summary class="flex cursor-pointer list-none items-center justify-between py-2.5 text-[16px] text-muted hover:text-highlighted [&::-webkit-details-marker]:hidden">
              {{ link.label }}
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <div class="mb-2 space-y-1">
              <NuxtLink
                v-for="item in link.children"
                :key="item.to"
                :to="item.to"
                class="flex items-start gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors hover:bg-primary/5"
                @click="open = false"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <UIcon
                    :name="item.icon"
                    class="size-5 text-primary"
                  />
                </span>
                <span class="min-w-0">
                  <span class="block font-medium text-highlighted">{{ item.label }}</span>
                  <span class="mt-1 block text-sm leading-relaxed text-muted">{{ item.description }}</span>
                </span>
              </NuxtLink>
            </div>
          </details>
          <NuxtLink
            v-else
            :to="link.to"
            prefetch
            class="block py-2.5 text-[16px] text-muted transition-colors hover:text-highlighted"
            @click="open = false"
          >{{ link.label }}</NuxtLink>
        </template>

        <UButton
          :to="accountDestination"
          prefetch
          block
          class="mt-3 rounded-full font-medium"
          @click="open = false"
        >
          {{ isSignedIn ? 'Dashboard' : 'Sign up free' }}
        </UButton>
      </nav>
    </div>
  </header>
</template>
