<script setup lang="ts">
const origin = useRuntimeConfig().public.siteUrl || useRequestURL().origin

useHead({
  script: [{
    key: 'calendza-home-structured-data',
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          'name': 'Calendza',
          'url': origin,
          'logo': `${origin}/favicon.svg`,
          'email': 'support@calendza.xyz'
        },
        {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          'name': 'Calendza',
          'url': origin,
          'publisher': { '@id': `${origin}/#organization` }
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${origin}/#software`,
          'name': 'Calendza',
          'url': origin,
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'Web',
          'description': 'Online scheduling software for booking pages, automated reminders, paid appointments and team scheduling.',
          'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'USD'
          },
          'featureList': [
            'Booking pages',
            'Single-use links and one-off meeting invitations',
            'Timezone-correct scheduling',
            'Reusable availability schedules',
            'Routing forms',
            'Workflow automation',
            'Booking analytics',
            'Paid bookings',
            'Group events',
            'Round-robin and collective team scheduling',
            'Embeddable booking overlays',
            'Google Calendar, Microsoft Calendar and Zoom integrations',
            'Cancellation and rescheduling'
          ],
          'publisher': { '@id': `${origin}/#organization` }
        }
      ]
    })
  }]
})
</script>

<template>
  <div>
    <LandingHero />
    <LandingHowItWorks />
    <LandingFeatures />
    <LandingUseCases />
    <LandingEmbedShowcase />
    <LandingTimezones />
    <LandingCta />
  </div>
</template>
