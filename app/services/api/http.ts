export function resource(path: string, id: string, suffix = ''): string {
  return `${path}/${encodeURIComponent(id)}${suffix}`
}

export function apiErrorMessage(failure: unknown, fallback: string): string {
  if (!failure || typeof failure !== 'object') return fallback
  const error = failure as {
    data?: { statusMessage?: string }
    statusMessage?: string
    message?: string
  }
  const message = error.data?.statusMessage ?? error.statusMessage
  return typeof message === 'string' && message.trim() ? message : fallback
}
