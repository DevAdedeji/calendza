<script setup lang="ts">
import { seoLandingPages } from '@/data/seo-landing-pages'

definePageMeta({ layout: 'default' })
const page = seoLandingPages['/use-cases/small-business']!
</script>

<template>
  <SeoLandingPage :page="page" />
</template>
