import { describe, expect, it } from 'vitest'
import { isPlatformAdminEmail } from '@@/server/services/session'

describe('platform administrator allow-list', () => {
  it('matches normalized email addresses only', () => {
    expect(isPlatformAdminEmail(' Admin@Calendza.xyz ', ['admin@calendza.xyz'])).toBe(true)
    expect(isPlatformAdminEmail('member@calendza.xyz', ['admin@calendza.xyz'])).toBe(false)
  })
})
