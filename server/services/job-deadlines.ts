import { sql } from 'drizzle-orm'
import { useDatabase } from '@@/server/database'
import { automationRuns, bookingPayments, calendarSyncJobs, domainEvents, emailOutbox, subscriptionSeatSyncJobs } from '@@/server/database/schema'

function deadline(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null
}

export async function nextCalendarSyncAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`min(case
    when ${calendarSyncJobs.status} = 'pending' then ${calendarSyncJobs.availableAt}
    when ${calendarSyncJobs.status} = 'processing' then ${calendarSyncJobs.lockedAt} + interval '10 minutes'
    end)` }).from(calendarSyncJobs)
  return deadline(row?.due)
}

export async function nextEmailAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`min(case
    when ${emailOutbox.status} = 'pending' then ${emailOutbox.availableAt}
    when ${emailOutbox.status} = 'sending' then ${emailOutbox.lockedAt} + interval '10 minutes'
    end)` }).from(emailOutbox)
  return deadline(row?.due)
}

export async function nextSeatSyncAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`min(case
    when ${subscriptionSeatSyncJobs.status} = 'pending' then ${subscriptionSeatSyncJobs.availableAt}
    when ${subscriptionSeatSyncJobs.status} = 'processing' then ${subscriptionSeatSyncJobs.lockedAt} + interval '10 minutes'
    end)` }).from(subscriptionSeatSyncJobs)
  return deadline(row?.due)
}

export async function nextAutomationAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`case
    when exists (select 1 from ${domainEvents} where ${domainEvents.dispatchedAt} is null) then now()
    else min(case
      when ${automationRuns.status} = 'pending' then ${automationRuns.availableAt}
      when ${automationRuns.status} = 'processing' then ${automationRuns.lockedAt} + interval '10 minutes'
    end) end` }).from(automationRuns)
  return deadline(row?.due)
}

export async function nextPaidBookingHoldAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`min(${bookingPayments.checkoutExpiresAt})` })
    .from(bookingPayments).where(sql`${bookingPayments.status} = 'pending' and ${bookingPayments.bachsCheckoutId} is not null`)
  return deadline(row?.due)
}

export async function nextPaidBookingRefundAt() {
  const [row] = await useDatabase().select({ due: sql<string | null>`min(${bookingPayments.updatedAt} + interval '15 minutes')` })
    .from(bookingPayments).where(sql`${bookingPayments.status} = 'refund_pending' and ${bookingPayments.bachsChargeId} is not null`)
  return deadline(row?.due)
}
