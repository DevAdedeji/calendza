export const BACHS_CHECKOUT_ORIGINS = [
  'https://checkout.bachs.io',
  'https://sandbox-checkout.bachs.io'
] as const

export function trustedCheckoutUrl(value: string): string {
  const url = new URL(value)
  if (url.username || url.password || !BACHS_CHECKOUT_ORIGINS.some(origin => origin === url.origin)) {
    throw new Error('Invalid Bachs checkout URL.')
  }
  return url.href
}
