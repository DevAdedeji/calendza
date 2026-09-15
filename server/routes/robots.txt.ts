import { useEnv } from '@@/server/config/env'

const disallowed = [
  '/api/',
  '/availability',
  '/booking/',
  '/bookings',
  '/control',
  '/dashboard',
  '/event-types',
  '/forgot-password',
  '/integrations',
  '/operations',
  '/invite/',
  '/meeting/',
  '/login',
  '/reset-password',
  '/settings',
  '/signup',
  '/t/',
  '/verify-email'
]

const PRODUCTION_HOST = 'calendza.xyz'

export default defineEventHandler((event) => {
  const { siteUrl } = useEnv()

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')

  if (new URL(siteUrl).host !== PRODUCTION_HOST) {
    return 'User-agent: *\nDisallow: /\n'
  }

  return [
    'User-agent: *',
    ...disallowed.map(path => `Disallow: ${path}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ''
  ].join('\n')
})
