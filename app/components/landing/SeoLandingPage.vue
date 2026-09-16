<script setup lang="ts">
import type { SeoLandingPageContent } from '@/data/seo-landing-pages'

const props = defineProps<{ page: SeoLandingPageContent }>()
const origin = useRuntimeConfig().public.siteUrl || useRequestURL().origin
const canonical = `${origin.replace(/\/$/, '')}${props.page.path}`
const { isSignedIn, accountDestination } = await useLandingNavigation()
const sectionName = props.page.path.startsWith('/features/') ? 'Features' : props.page.path.startsWith('/compare/') ? 'Compare' : 'Use cases'

useSeoMeta({
  title: props.page.metaTitle,
  description: props.page.metaDescription,
  ogTitle: props.page.metaTitle,
  ogDescription: props.page.metaDescription,
  ogUrl: canonical,
  twitterTitle: props.page.metaTitle,
  twitterDescription: props.page.metaDescription
})

useHead({
  link: [{ key: 'canonical', rel: 'canonical', href: canonical }],
  script: [{
    key: `structured-data-${props.page.path}`,
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          'url': canonical,
          'name': props.page.metaTitle,
          'description': props.page.metaDescription,
          'isPartOf': {
            '@type': 'WebSite',
            '@id': `${origin.replace(/\/$/, '')}/#website`,
            'name': 'Calendza',
            'url': origin
          }
        },
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': origin },
            { '@type': 'ListItem', 'position': 2, 'name': sectionName },
            { '@type': 'ListItem', 'position': 3, 'name': props.page.eyebrow, 'item': canonical }
          ]
        },
        {
          '@type': 'FAQPage',
          'mainEntity': props.page.faqs.map(item => ({
            '@type': 'Question',
            'name': item.question,
            'acceptedAnswer': { '@type': 'Answer', 'text': item.answer }
          }))
        }
      ]
    })
  }]
})
</script>

<template>
  <div class="bg-muted">
    <section class="border-b border-default">
      <div class="mx-auto max-w-312 px-6 pb-20 pt-8 lg:px-10 lg:pb-28 lg:pt-10">
        <nav
          aria-label="Breadcrumb"
          class="flex flex-wrap items-center gap-2 text-[14px] text-dimmed"
        >
          <NuxtLink
            to="/"
            class="transition-colors hover:text-highlighted"
          >Home</NuxtLink>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5"
          />
          <NuxtLink
            v-if="sectionName === 'Use cases'"
            to="/#use-cases"
            class="transition-colors hover:text-highlighted"
          >{{ sectionName }}</NuxtLink>
          <span v-else>{{ sectionName }}</span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5"
          />
          <span class="text-toned">{{ page.eyebrow }}</span>
        </nav>

        <div class="mt-14 grid items-end gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-20">
          <div>
            <p class="eyebrow text-primary">
              {{ page.eyebrow }}
            </p>
            <h1 class="mt-6 max-w-[18ch] font-editorial text-[clamp(3rem,7vw,5.75rem)] font-normal leading-[0.96] tracking-[-0.025em] text-highlighted">
              {{ page.headline }}
            </h1>
            <p class="mt-7 max-w-[58ch] text-[18px] leading-[1.7] text-toned">
              {{ page.intro }}
            </p>
            <div class="mt-9 flex flex-wrap gap-3">
              <UButton
                :to="accountDestination"
                size="xl"
                class="rounded-full px-7 font-medium"
              >
                {{ isSignedIn ? 'Go to dashboard' : page.ctaLabel || 'Create your booking page' }}
              </UButton>
              <UButton
                :to="page.walkthrough ? '#booking-example' : '/features'"
                size="xl"
                color="neutral"
                variant="outline"
                class="rounded-full px-7 font-medium"
              >
                {{ page.walkthrough ? 'See a booking example' : 'Explore features' }}
              </UButton>
            </div>
          </div>

          <aside
            v-if="page.walkthrough"
            class="rounded-2xl border border-default bg-default p-6 sm:p-8"
          >
            <p class="eyebrow text-dimmed">
              The problem it solves
            </p>
            <h2 class="mt-5 text-xl font-semibold text-highlighted">
              {{ page.problemTitle }}
            </h2>
            <p class="mt-3 text-[16px] leading-relaxed text-muted">
              {{ page.problemDescription }}
            </p>
            <p class="mt-5 border-t border-default pt-5 text-sm leading-relaxed text-muted">
              For {{ page.useCases.join(', ').toLowerCase() }}.
            </p>
          </aside>
          <aside
            v-else
            class="rounded-2xl border border-default bg-default p-6 sm:p-8"
          >
            <p class="eyebrow text-dimmed">
              Built for
            </p>
            <ul class="mt-5 divide-y divide-default">
              <li
                v-for="useCase in page.useCases"
                :key="useCase"
                class="flex items-center gap-3 py-3.5 text-[16px] font-medium text-highlighted"
              >
                <UIcon
                  name="i-lucide-circle-check"
                  class="size-4 shrink-0 text-primary"
                />
                {{ useCase }}
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>

    <section
      v-if="page.walkthrough"
      id="booking-example"
      aria-labelledby="booking-example-title"
      class="scroll-mt-24 border-b border-default bg-default"
    >
      <div class="mx-auto max-w-312 px-6 py-14 lg:px-10 lg:py-20">
        <p class="eyebrow text-primary">
          See it in practice
        </p>
        <h2
          id="booking-example-title"
          class="mt-5 max-w-3xl font-editorial text-[clamp(2.1rem,5vw,3.5rem)] leading-tight text-highlighted"
        >
          {{ page.walkthrough.title }}
        </h2>
        <p class="mt-5 max-w-[68ch] text-[17px] leading-relaxed text-toned">
          {{ page.walkthrough.description }}
        </p>
        <p class="mt-3 max-w-[80ch] text-sm leading-relaxed text-muted">
          {{ page.walkthrough.note }}
        </p>
        <div class="mt-10 space-y-12">
          <article
            v-for="scene in page.walkthrough.scenes"
            :key="scene.title"
            class="grid min-w-0 items-center gap-6"
            :class="scene.screenshot ? 'lg:grid-cols-[1.6fr_1fr] lg:gap-10' : 'rounded-2xl border border-default bg-muted p-6 sm:p-8'"
          >
            <figure
              v-if="scene.screenshot"
              class="min-w-0"
            >
              <figcaption class="mb-3 text-sm text-muted sm:hidden">
                Swipe to explore, or use the full-size link below.
              </figcaption>
              <div
                tabindex="0"
                role="region"
                :aria-label="`${scene.title} screenshot. Scroll horizontally to explore.`"
                class="overflow-x-auto overscroll-x-contain rounded-2xl border border-default bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <img
                  :src="scene.screenshot.src"
                  :alt="scene.screenshot.alt"
                  :width="scene.screenshot.width"
                  :height="scene.screenshot.height"
                  loading="lazy"
                  decoding="async"
                  class="block h-auto w-full min-w-176 sm:min-w-0"
                >
              </div>
            </figure>
            <div>
              <h3 class="text-xl font-semibold tracking-tight text-highlighted">
                {{ scene.title }}
              </h3>
              <p class="mt-3 max-w-[55ch] text-base leading-relaxed text-toned">
                {{ scene.description }}
              </p>
              <a
                v-if="scene.screenshot"
                :href="scene.screenshot.src"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`View full-size screenshot: ${scene.title} (opens in a new tab)`"
                class="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
              >
                View full-size screenshot
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section
      v-if="!page.walkthrough"
      class="border-b border-default bg-default"
    >
      <div class="mx-auto max-w-312 px-6 py-20 lg:px-10 lg:py-24">
        <div class="max-w-3xl">
          <p class="eyebrow text-primary">
            Why Calendza
          </p>
          <h2 class="mt-5 font-editorial text-[clamp(2.35rem,5vw,4rem)] leading-[1.02] tracking-[-0.02em] text-highlighted">
            {{ page.problemTitle }}
          </h2>
          <p class="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            {{ page.problemDescription }}
          </p>
        </div>

        <div class="mt-12 grid gap-px overflow-hidden rounded-2xl border border-default bg-default md:grid-cols-3">
          <article
            v-for="benefit in page.benefits"
            :key="benefit.title"
            class="surface-secondary p-7 lg:p-8"
          >
            <span class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon
                :name="benefit.icon"
                class="size-5"
              />
            </span>
            <h3 class="mt-8 text-[18px] font-semibold tracking-tight text-highlighted">
              {{ benefit.title }}
            </h3>
            <p class="mt-3 text-[15px] leading-relaxed text-muted">
              {{ benefit.description }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="border-b border-default">
      <div class="mx-auto grid max-w-312 gap-12 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:px-10 lg:py-24">
        <div>
          <p class="eyebrow text-dimmed">
            {{ page.walkthrough ? 'Get started' : 'How it works' }}
          </p>
          <h2 class="mt-5 max-w-[14ch] font-editorial text-[clamp(2.35rem,5vw,3.75rem)] leading-[1.03] tracking-[-0.02em] text-highlighted">
            {{ page.walkthrough ? 'Set it up in three steps.' : 'A clear path from setup to booked.' }}
          </h2>
        </div>

        <ol class="divide-y divide-default border-y border-default">
          <li
            v-for="(step, index) in page.steps"
            :key="step.title"
            class="grid gap-3 py-7 sm:grid-cols-[3rem_12rem_1fr] sm:gap-6"
          >
            <span class="tnum text-[14px] font-semibold text-primary">0{{ index + 1 }}</span>
            <h3 class="text-[17px] font-semibold text-highlighted">
              {{ step.title }}
            </h3>
            <p class="text-[15px] leading-relaxed text-muted">
              {{ step.description }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <section class="border-b border-default bg-default">
      <div class="mx-auto grid max-w-312 gap-12 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:px-10 lg:py-24">
        <div>
          <p class="eyebrow text-primary">
            Questions, answered
          </p>
          <h2 class="mt-5 font-editorial text-[clamp(2.35rem,5vw,3.75rem)] leading-[1.03] tracking-[-0.02em] text-highlighted">
            The details that matter.
          </h2>
        </div>

        <div class="divide-y divide-default border-y border-default">
          <details
            v-for="(faq, index) in page.faqs"
            :key="faq.question"
            :open="index === 0"
            class="group py-6"
          >
            <summary class="flex cursor-pointer list-none items-start justify-between gap-6 text-[17px] font-semibold text-highlighted">
              {{ faq.question }}
              <UIcon
                name="i-lucide-plus"
                class="mt-0.5 size-5 shrink-0 text-primary transition-transform group-open:rotate-45"
              />
            </summary>
            <p class="mt-4 max-w-[68ch] pr-10 text-[15px] leading-relaxed text-muted">
              {{ faq.answer }}
            </p>
          </details>
        </div>
      </div>
    </section>

    <section>
      <div class="mx-auto max-w-312 px-6 py-20 lg:px-10 lg:py-24">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p class="eyebrow text-dimmed">
              Keep exploring
            </p>
            <h2 class="mt-4 font-editorial text-[clamp(2.2rem,4vw,3.25rem)] leading-none text-highlighted">
              Find the scheduling flow that fits.
            </h2>
          </div>
          <UButton
            to="/pricing"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-arrow-right"
            class="self-start rounded-full font-medium sm:self-auto"
          >
            Compare plans
          </UButton>
        </div>

        <div class="mt-10 grid gap-4 md:grid-cols-3">
          <NuxtLink
            v-for="item in page.related"
            :key="item.to"
            :to="item.to"
            class="group rounded-2xl border border-default bg-default p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div class="flex items-start justify-between gap-4">
              <h3 class="text-[17px] font-semibold text-highlighted">
                {{ item.label }}
              </h3>
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-4 shrink-0 text-dimmed transition group-hover:text-primary"
              />
            </div>
            <p class="mt-3 text-[15px] leading-relaxed text-muted">
              {{ item.description }}
            </p>
          </NuxtLink>
        </div>
        <div
          v-if="page.walkthrough"
          class="mt-12 flex flex-wrap items-center gap-4 border-t border-default pt-8"
        >
          <UButton
            :to="accountDestination"
            size="xl"
            class="max-w-full whitespace-normal rounded-full px-7"
          >
            {{ isSignedIn ? 'Go to dashboard' : page.ctaLabel }}
          </UButton>
          <NuxtLink
            to="/pricing"
            class="text-sm font-medium text-primary underline underline-offset-4"
          >
            See plans and what is included
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
