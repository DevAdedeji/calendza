<script setup lang="ts">
import { seoLandingPages } from '@/data/seo-landing-pages'

definePageMeta({ layout: 'default' })
const page = seoLandingPages['/use-cases/team-scheduling']!
</script>

<template>
  <SeoLandingPage :page="page" />
</template>
