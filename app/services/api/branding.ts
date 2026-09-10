import type { PersonalBrandingInput, PublicPersonalBranding, OrganizationBrandingInput } from '#shared/branding'
import { resource } from '@/services/api/http'

export const brandingApi = {
  endpoint: '/api/personal-branding' as const,
  update: (body: PersonalBrandingInput) => $fetch<{ branding: PublicPersonalBranding }>('/api/personal-branding', { method: 'PATCH', body }),
  uploadLogo: (file: File) => {
    const body = new FormData()
    body.append('logo', file)
    return $fetch<{ logoUrl: string }>('/api/profile/brand-logo', { method: 'PUT', body })
  },
  removeLogo: () => $fetch('/api/profile/brand-logo', { method: 'DELETE' })
}

export const teamBrandingApi = {
  endpoint: (slug: string) => resource('/api/teams', slug, '/branding'),
  update: (slug: string, body: OrganizationBrandingInput) =>
    $fetch<{ branding: PublicPersonalBranding }>(resource('/api/teams', slug, '/branding'), { method: 'PATCH', body }),
  uploadLogo: (slug: string, file: File) => {
    const body = new FormData()
    body.append('logo', file)
    return $fetch<{ logoUrl: string }>(resource('/api/teams', slug, '/brand-logo'), { method: 'PUT', body })
  },
  removeLogo: (slug: string) =>
    $fetch(resource('/api/teams', slug, '/brand-logo'), { method: 'DELETE' })
}
