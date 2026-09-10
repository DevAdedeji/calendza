import { z } from 'zod'

const identifier = z.string().min(1).max(255)
const metadata = z.record(z.string(), z.string()).nullish()
const nullableText = z.string().nullish()
const providerDate = z.string().refine(value => Number.isFinite(Date.parse(value)), 'Invalid provider date').nullish()

export const bachsSubscriptionSchema = z.object({
  id: identifier,
  status: z.enum(['trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused']),
  collection_method: z.string().optional(),
  payment_method_id: nullableText,
  quantity: z.number().int().nonnegative().optional(),
  current_period_end: providerDate,
  next_billed_at: providerDate,
  trial_end: providerDate,
  cancel_at_period_end: z.boolean().optional(),
  metadata,
  product: z.object({ id: identifier, name: z.string(), metadata }).nullish()
})

const dataSchema = z.looseObject({
  id: identifier.optional(),
  charge_id: nullableText,
  checkout_id: nullableText,
  reference: z.string().optional(),
  status: z.string().optional(),
  amount: z.string().optional(),
  amount_paid: nullableText,
  amount_collected: nullableText,
  amount_remaining: nullableText,
  settlement_amount: z.string().optional(),
  settlement_currency: nullableText,
  fee: z.union([z.string(), z.object({ amount: nullableText })]).nullish(),
  fees: z.object({ amount: nullableText }).nullish(),
  payment_method: z.union([z.string(), z.object({ type: nullableText, name: nullableText })]).nullish(),
  metadata,
  payment_status: nullableText,
  currency: nullableText,
  account: nullableText,
  refund_id: nullableText,
  withdrawal_id: nullableText,
  charge: z.object({ id: nullableText, amount: nullableText, currency: nullableText, status: nullableText }).nullish()
})

export const bachsEventSchema = z.object({
  id: identifier.optional(),
  type: identifier.optional(),
  organization_id: identifier.optional(),
  account: identifier.optional(),
  data: dataSchema.optional()
})

export const bachsWebhookSchema = bachsEventSchema.extend({ id: identifier })
export type BachsEvent = z.infer<typeof bachsEventSchema>
