import { eq, sql } from 'drizzle-orm'
import { userAvatars, users } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database/index'
import { requireAuthSession } from '@@/server/services/session'

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event)
  await useDatabase().transaction(async (tx) => {
    await tx.delete(userAvatars).where(eq(userAvatars.userId, session.user.id))
    await tx.update(users).set({ avatarUrl: null, updatedAt: sql`now()` }).where(eq(users.id, session.user.id))
  })
  return { ok: true }
})
