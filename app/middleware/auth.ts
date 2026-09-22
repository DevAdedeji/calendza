export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await useCurrentUser()

  if (!data.value?.user) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }

  if (to.path === '/dashboard' && data.value.user.bookingSetupStatus === 'pending') {
    return navigateTo('/onboarding')
  }
})
