import type { H3Event } from 'h3'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogFields = Record<string, unknown>

const SECRET_KEY = /(authorization|cookie|token|secret|password|credential|signature|payload|body)/i
const EMAIL_KEY = /(email|recipient)/i
const MAX_DEPTH = 6

function safeValue(key: string, value: unknown, ancestors: Set<object>, depth: number): unknown {
  if (SECRET_KEY.test(key)) return '[redacted]'
  if (EMAIL_KEY.test(key) && typeof value === 'string') {
    const [local, domain] = value.split('@')
    return domain ? `${local?.slice(0, 2) ?? ''}***@${domain}` : '[redacted]'
  }
  if (value instanceof Error) {
    // Provider and database messages can contain credentials or submitted data.
    const error = value as Error & { code?: unknown, statusCode?: unknown }
    return {
      name: value.name.slice(0, 80),
      ...(typeof error.code === 'string' ? { code: error.code.slice(0, 80) } : {}),
      ...(typeof error.statusCode === 'number' ? { statusCode: error.statusCode } : {})
    }
  }
  if (value && typeof value === 'object') {
    if (ancestors.has(value)) return '[circular]'
    if (depth >= MAX_DEPTH) return '[truncated]'
    ancestors.add(value)
    const sanitized = Array.isArray(value)
      ? value.slice(0, 25).map(item => safeValue(key, item, ancestors, depth + 1))
      : Object.fromEntries(Object.entries(value).slice(0, 50).map(([nestedKey, nested]) => [nestedKey, safeValue(nestedKey, nested, ancestors, depth + 1)]))
    ancestors.delete(value)
    return sanitized
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.slice(0, 1000)
  return value
}

export function sanitizeLogFields(fields: LogFields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, safeValue(key, value, new Set(), 0)]))
}

export function logEvent(level: LogLevel, name: string, fields: LogFields = {}, event?: H3Event) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event: name,
    service: 'schedra',
    environment: process.env.NODE_ENV ?? 'development',
    ...(event?.context.requestId ? { requestId: event.context.requestId } : {}),
    ...sanitizeLogFields(fields)
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}
