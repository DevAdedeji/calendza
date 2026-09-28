import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { TEAM_PLAN, type BillingInterval } from '#shared/billing'
import { members, organizationSubscriptions, organizations, users } from '@@/server/database/schema'
import { useDatabase } from '@@/server/database'
import { emailDedupeKey, enqueueEmails } from '@@/server/services/email-outbox'
import { useEnv } from '@@/server/config/env'
import { addToInstant, DAY_MS, subtractFromInstant } from '@@/server/utils/date-time'

/**
 * Bachs retries a saved card on its own, so a subscription needs no chasing.
 * Only the invoice path does: nothing can charge a bank transfer for us, so a
 * team that is never reminded simply lapses.
 */
type Stage = 'trial_ending' | 'trial_over' | 'period_ending' | 'grace' | 'locked'

interface Due {
  organizationId: string
  name: string
  slug: string
  stage: Stage
  seats: number
  interval: BillingInterval
  deadline: Date
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS)
}

function stageFor(row: {
  status: string
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}, now: Date): Stage | null {
  const deadline = row.status === 'trialing' ? row.trialEndsAt : row.currentPeriodEnd
  if (!deadline) return null

  const days = daysBetween(now, deadline)
  const trialing = row.status === 'trialing'

  // One message per stage, not one per day: a nag every morning gets filtered.
  if (days > 7) return null
  if (days > 0) return trialing ? 'trial_ending' : 'period_ending'

  const sinceEnd = -days
  if (sinceEnd === 0) return trialing ? 'trial_over' : 'period_ending'
  if (sinceEnd <= TEAM_PLAN.graceDays) return 'grace'
  return 'locked'
}

const COPY: Record<Stage, (input: { name: string, amount: string, days: number }) => {
  subject: string
  heading: string
  body: string
  action: string
}> = {
  trial_ending: ({ name, amount, days }) => ({
    subject: `${name}: ${days} ${days === 1 ? 'day' : 'days'} left on your Calendza trial`,
    heading: 'Your trial is nearly up',
    body: `${name} has ${days} ${days === 1 ? 'day' : 'days'} left of its free trial. You can start a USD card subscription at ${amount} for the members who have joined.\n\nThe trial does not charge you automatically. A paid subscription renews automatically until cancelled.`,
    action: 'View subscription options'
  }),
  trial_over: ({ name, amount }) => ({
    subject: `${name}: your Calendza trial has ended`,
    heading: 'Your trial has ended',
    body: `${name} is now in its ${TEAM_PLAN.graceDays}-day grace period. Team booking pages are still taking bookings. Start a USD card subscription at ${amount} to keep them active. It renews automatically until cancelled.\n\nYour existing bookings and team data are retained.`,
    action: 'View subscription options'
  }),
  period_ending: ({ name, amount, days }) => ({
    subject: `${name}: your paid Calendza term is ending`,
    heading: 'Your paid term is ending',
    body: `${name}'s paid term ends in ${Math.max(days, 0)} ${days === 1 ? 'day' : 'days'}. It will not renew automatically.\n\nAfter it ends, you can choose a USD card subscription at ${amount} for the members who have joined. The new subscription renews automatically until cancelled.`,
    action: 'View billing'
  }),
  grace: ({ name, amount }) => ({
    subject: `${name}: payment needed to keep taking bookings`,
    heading: 'Payment still outstanding',
    body: `${name}'s grace period ends soon, after which team booking pages stop taking new bookings.\n\nBookings, members and exports are retained. Start a USD card subscription at ${amount} to keep the team active once payment is confirmed. It renews automatically until cancelled.`,
    action: 'View subscription options'
  }),
  locked: ({ name, amount }) => ({
    subject: `${name} is now read-only`,
    heading: 'Your team is read-only',
    body: `${name} has stopped taking new bookings because its trial or paid term has ended.\n\nYour bookings, members and exports are retained. A USD card subscription at ${amount} restores access once payment is confirmed, then renews automatically until cancelled.`,
    action: 'Reactivate the team'
  })
}

async function findDue(now: Date): Promise<Due[]> {
  const db = useDatabase()
  const horizon = addToInstant(now, { hours: 8 * 24 })

  const rows = await db
    .select({
      organizationId: organizationSubscriptions.organizationId,
      status: organizationSubscriptions.status,
      interval: organizationSubscriptions.interval,
      trialEndsAt: organizationSubscriptions.trialEndsAt,
      currentPeriodEnd: organizationSubscriptions.currentPeriodEnd,
      name: organizations.name,
      slug: organizations.slug,
      seats: sql<number>`(select count(*) from ${members} where ${members.organizationId} = ${organizationSubscriptions.organizationId})`.mapWith(Number)
    })
    .from(organizationSubscriptions)
    .innerJoin(organizations, eq(organizations.id, organizationSubscriptions.organizationId))
    .where(and(
      // Only the invoice path; Bachs chases its own card subscriptions.
      eq(organizationSubscriptions.collectionMethod, 'invoice'),
      isNull(organizations.archivedAt),
      inArray(organizationSubscriptions.status, ['trialing', 'active', 'past_due']),
      sql`coalesce(${organizationSubscriptions.trialEndsAt}, ${organizationSubscriptions.currentPeriodEnd}) <= ${horizon.toISOString()}::timestamptz`
    ))

  const due: Due[] = []

  for (const row of rows) {
    const stage = stageFor(row, now)
    if (!stage) continue

    const deadline = row.status === 'trialing' ? row.trialEndsAt : row.currentPeriodEnd
    due.push({
      organizationId: row.organizationId,
      name: row.name,
      slug: row.slug,
      stage,
      seats: row.seats,
      interval: row.interval as BillingInterval,
      deadline: deadline!
    })
  }

  return due
}

/**
 * Reminders go to owners only — they are the ones who can act, and a member
 * being chased about a bill they cannot pay is noise.
 */
async function ownersOf(organizationId: string) {
  return useDatabase()
    .select({ email: users.email, name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.organizationId, organizationId), eq(members.role, 'owner')))
}

export async function processBillingReminders(now = new Date()) {
  if (!useEnv().bachsSecretKey) return { sent: 0, skipped: 'billing-not-configured' as const }

  const env = useEnv()
  const due = await findDue(now)
  let sent = 0

  for (const team of due) {
    const owners = await ownersOf(team.organizationId)
    if (!owners.length) continue

    const amount = 'the current total shown on your billing page'
    const copy = COPY[team.stage]({
      name: team.name,
      amount,
      days: Math.max(daysBetween(now, team.deadline), 0)
    })
    const url = `${env.siteUrl}/t/${team.slug}/billing`

    await enqueueEmails(owners.map(owner => ({
      // Keyed by stage and deadline, so a stage is announced once even though
      // the sweep runs many times before it passes.
      dedupeKey: emailDedupeKey(
        'billing-reminder',
        `${team.organizationId}:${team.stage}:${team.deadline.toISOString().slice(0, 10)}:${owner.email}`
      ),
      email: {
        to: owner.email,
        subject: copy.subject,
        preheader: `${team.name} · ${amount}`,
        heading: copy.heading,
        body: copy.body,
        action: { label: copy.action, url },
        footer: 'You are getting this because you own this team on Calendza.'
      }
    })))

    sent += owners.length
  }

  return { sent, teams: due.length }
}

/** Moves lapsed invoice teams to canceled so entitlement stops deriving grace. */
export async function expireLapsedTeams(now = new Date()) {
  const cutoff = subtractFromInstant(now, { hours: TEAM_PLAN.graceDays * 24 })

  const updated = await useDatabase()
    .update(organizationSubscriptions)
    .set({ status: 'canceled', updatedAt: sql`now()` })
    .where(and(
      eq(organizationSubscriptions.collectionMethod, 'invoice'),
      inArray(organizationSubscriptions.status, ['trialing', 'active', 'past_due']),
      sql`coalesce(${organizationSubscriptions.trialEndsAt}, ${organizationSubscriptions.currentPeriodEnd}) <= ${cutoff.toISOString()}::timestamptz`
    ))
    .returning({ organizationId: organizationSubscriptions.organizationId })

  return updated.length
}
