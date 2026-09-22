import { z } from 'zod'
import { eventTypeSchema, refineMeetingLocation, scheduleSchema } from '#shared/validation'

export const firstBookingDetailsSchema = z.object({
  title: eventTypeSchema.shape.title,
  slug: eventTypeSchema.shape.slug,
  durationMinutes: eventTypeSchema.shape.durationMinutes
})

export const firstBookingEventSchema = firstBookingDetailsSchema.extend({
  locationType: eventTypeSchema.shape.locationType,
  locationDetails: eventTypeSchema.shape.locationDetails
}).superRefine(refineMeetingLocation)

export const firstBookingScheduleSchema = scheduleSchema.pick({ timeZone: true, rules: true }).extend({
  rules: scheduleSchema.shape.rules.min(1, 'Choose at least one available day.')
}).superRefine(({ rules }, context) => {
  for (const [index, rule] of rules.entries()) {
    if (rules.some((other, otherIndex) => otherIndex < index && other.weekday === rule.weekday
      && other.start < rule.end && other.end > rule.start)) {
      context.addIssue({ code: 'custom', path: ['rules', index], message: 'Available hours on the same day must not overlap.' })
    }
  }
})

export const firstBookingSetupSchema = z.object({
  event: firstBookingEventSchema,
  schedule: firstBookingScheduleSchema
})

export type FirstBookingSetupInput = z.infer<typeof firstBookingSetupSchema>
export type BookingSetupStatus = 'pending' | 'skipped' | 'completed'
