export const accountApi = {
  exportUrl: '/api/account/export' as const,
  remove: (body: { email: string, confirmation: 'DELETE' }) => $fetch('/api/account', { method: 'DELETE', body })
}

export const authApi = {
  resendVerification: (email: string, callbackURL: string) =>
    $fetch('/api/resend-verification', {
      method: 'POST',
      body: { email, callbackURL }
    })
}
