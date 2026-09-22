import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { PaymentCurrency } from '#shared/payments'
import { accounts, bookingSetups, users } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database'

export async function profileForUser(userId: string) {
  const database = useDatabase()
  const [profile] = await database.select({
    id: users.id,
    name: users.name,
    email: users.email,
    emailVerified: users.emailVerified,
    username: users.username,
    timeZone: users.timeZone,
    preferredCurrency: users.preferredCurrency,
    bio: users.bio,
    avatarUrl: users.avatarUrl,
    twoFactorEnabled: users.twoFactorEnabled,
    bookingSetupStatus: bookingSetups.status
  }).from(users).leftJoin(bookingSetups, eq(bookingSetups.userId, users.id)).where(eq(users.id, userId)).limit(1)

  if (!profile) return null

  const [passwordAccount] = await database.select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNotNull(accounts.password)))
    .limit(1)

  return { ...profile, hasPassword: Boolean(passwordAccount) }
}

export async function updatePreferredCurrency(userId: string, preferredCurrency: PaymentCurrency) {
  const [updated] = await useDatabase().update(users)
    .set({ preferredCurrency, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning({ preferredCurrency: users.preferredCurrency })
  return updated ?? null
}
