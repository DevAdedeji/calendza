import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { configureAppTestEnvironment, getTestDatabaseUrl } from '@@/test/helpers/database'

const url = getTestDatabaseUrl()

describe.skipIf(!url)('routing form database invariants', () => {
  const sql = postgres(url!, { max: 3, onnotice: () => {} })
  let userId: string
  let eventTypeId: string

  beforeEach(async () => {
    configureAppTestEnvironment(url!)
    const { resetEnv } = await import('@@/server/config/env')
    resetEnv()
    await sql`truncate table routing_responses, routing_rules, routing_forms, event_types, users, organizations restart identity cascade`
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, username) values ('router@example.com', 'Route Host', 'route-host') returning id
    `
    userId = user!.id
    const [eventType] = await sql<{ id: string }[]>`
      insert into event_types (user_id, slug, title, duration_minutes) values (${userId}, 'discovery', 'Discovery', 30) returning id
    `
    eventTypeId = eventType!.id
  })

  afterAll(async () => {
    await sql`truncate table routing_responses, routing_rules, routing_forms, event_types, users, organizations restart identity cascade`
    await sql.end()
  })

  it('requires exactly one owner and at least one question', async () => {
    await expect(sql`
      insert into routing_forms (default_event_type_id, slug, title, questions)
      values (${eventTypeId}, 'ownerless', 'Ownerless', ${sql.json([{ id: crypto.randomUUID(), label: 'Question', options: ['A', 'B'], required: true }])})
    `).rejects.toMatchObject({ code: '23514' })

    await expect(sql`
      insert into routing_forms (user_id, default_event_type_id, slug, title, questions)
      values (${userId}, ${eventTypeId}, 'empty', 'Empty', '[]'::jsonb)
    `).rejects.toMatchObject({ code: '23514' })
  })

  it('creates more than 20 forms and lists them across bounded pages', async () => {
    const { createRoutingForm, listRoutingForms } = await import('@@/server/services/routing-forms')
    for (let i = 0; i < 21; i++) {
      await createRoutingForm({ userId }, {
        slug: `form-${i}`, title: `Form ${i}`, description: '', active: true,
        defaultEventTypeId: eventTypeId,
        questions: [{ id: crypto.randomUUID(), label: 'Question', options: ['A', 'B'], required: true }],
        rules: []
      })
    }
    const first = await listRoutingForms({ userId }, 1, 10)
    const last = await listRoutingForms({ userId }, 3, 10)
    expect(first.items).toHaveLength(10)
    expect(first.pagination).toMatchObject({ total: 21, totalPages: 3 })
    expect(last.items).toHaveLength(1)
    expect(first.items.some(item => item.id === last.items[0]?.id)).toBe(false)
  })

  it('keeps public slugs unique per owner regardless of case', async () => {
    const questions = sql.json([{ id: crypto.randomUUID(), label: 'Question', options: ['A', 'B'], required: true }])
    await sql`
      insert into routing_forms (user_id, default_event_type_id, slug, title, questions)
      values (${userId}, ${eventTypeId}, 'Find-Me', 'First', ${questions})
    `
    await expect(sql`
      insert into routing_forms (user_id, default_event_type_id, slug, title, questions)
      values (${userId}, ${eventTypeId}, 'find-me', 'Second', ${questions})
    `).rejects.toMatchObject({ code: '23505' })
  })

  it('preserves response history when rules change and removes it with its owner form', async () => {
    const questionId = crypto.randomUUID()
    const [form] = await sql<{ id: string }[]>`
      insert into routing_forms (user_id, default_event_type_id, slug, title, questions)
      values (${userId}, ${eventTypeId}, 'qualify', 'Qualify', ${sql.json([{ id: questionId, label: 'Question', options: ['A', 'B'], required: true }])}) returning id
    `
    const [rule] = await sql<{ id: string }[]>`
      insert into routing_rules (form_id, event_type_id, name, position, conditions)
      values (${form!.id}, ${eventTypeId}, 'A route', 0, ${sql.json([{ questionId, operator: 'equals', value: 'A' }])}) returning id
    `
    await sql`
      insert into routing_responses (form_id, matched_rule_id, event_type_id, respondent_name, respondent_email, answers)
      values (${form!.id}, ${rule!.id}, ${eventTypeId}, 'Guest', 'guest@example.com', ${sql.json({ [questionId]: 'A' })})
    `
    await sql`delete from routing_rules where id = ${rule!.id}`
    const [response] = await sql<{ matched_rule_id: string | null }[]>`select matched_rule_id from routing_responses`
    expect(response?.matched_rule_id).toBeNull()
    await sql`delete from routing_forms where id = ${form!.id}`
    const [deleted] = await sql<{ count: number }[]>`select count(*)::int as count from routing_responses`
    expect(deleted?.count).toBe(0)
  })
})
