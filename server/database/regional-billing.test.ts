import postgres from 'postgres'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingInterval, CollectionCurrency } from '#shared/billing'
import { configureAppTestEnvironment, getTestDatabaseUrl } from '@@/test/helpers/database'

const url = getTestDatabaseUrl()
type Plan = 'personal' | 'team'
type ProviderRequest = { path: string, method: string, body: Record<string, unknown> }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe.skipIf(!url)('regional subscription billing persistence', () => {
  const sql = postgres(url!, { max: 3, onnotice: () => {} })
  const userIds: string[] = []
  const organizationIds: string[] = []
  let requests: ProviderRequest[] = []

  function provider(options: { checkoutFailure?: boolean } = {}) {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = new URL(input instanceof Request ? input.url : String(input))
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
      const request = { path: requestUrl.pathname, method: init?.method ?? 'GET', body }
      requests.push(request)

      if (request.path.endsWith('/products') && request.method === 'GET') {
        return json({
          items: [
            { id: 'prod_personal', metadata: { schedra_plan: 'personal_pro_monthly' } },
            { id: 'prod_team', metadata: { schedra_plan: 'team_monthly_seats_2' } }
          ],
          pagination: { has_more: false, next_cursor: null }
        })
      }
      if (request.path.endsWith('/checkout-sessions')) {
        if (options.checkoutFailure) return json({ detail: 'Checkout unavailable' }, 503)
        return json({
          checkout_id: 'checkout_regional_test', checkout_url: 'https://checkout.bachs.io/test',
          status: 'open', reference: body.reference
        })
      }
      throw new Error(`Unexpected provider request: ${request.method} ${request.path}`)
    }))
  }

  async function fixture(plan: Plan) {
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, name, username, email_verified)
      values (${`regional-${crypto.randomUUID()}@example.com`}, 'Regional Test', ${`regional-${crypto.randomUUID()}`}, true)
      returning id
    `
    const userId = user!.id
    userIds.push(userId)
    let organizationId = ''
    if (plan === 'team') {
      const [organization] = await sql<{ id: string }[]>`
        insert into organizations (name, slug)
        values ('Regional Test Team', ${`regional-${crypto.randomUUID()}`}) returning id
      `
      organizationId = organization!.id
      organizationIds.push(organizationId)
      const [member] = await sql<{ id: string }[]>`
        insert into users (email, name, username, email_verified)
        values (${`regional-${crypto.randomUUID()}@example.com`}, 'Second Member', ${`regional-${crypto.randomUUID()}`}, true)
        returning id
      `
      userIds.push(member!.id)
      await sql`insert into members (organization_id, user_id, role) values
        (${organizationId}, ${userId}, 'owner'), (${organizationId}, ${member!.id}, 'member')`
      await sql`insert into organization_subscriptions (organization_id, status) values (${organizationId}, 'canceled')`
    }

    return {
      userId,
      ownerId: plan === 'personal' ? userId : organizationId,
      invoices: plan === 'personal' ? 'personal_invoices' : 'organization_invoices',
      subscriptions: plan === 'personal' ? 'personal_subscriptions' : 'organization_subscriptions',
      ownerColumn: plan === 'personal' ? 'user_id' : 'organization_id',
      async checkout(currency: CollectionCurrency = 'NGN', interval: BillingInterval = 'monthly', requestId = crypto.randomUUID()) {
        const customer = { email: 'regional-billing@example.com', name: 'Regional Test' }
        if (plan === 'personal') {
          const { startPersonalCheckout } = await import('@@/server/services/personal-billing')
          return startPersonalCheckout({ userId, interval, collectionCurrency: currency, requestId, customer })
        }
        const { startCheckout } = await import('@@/server/services/billing')
        return startCheckout({
          organizationId, organizationName: 'Regional Test Team', organizationSlug: 'regional-test',
          actorUserId: userId, interval, collectionCurrency: currency, customer
        })
      }
    }
  }

  beforeEach(async () => {
    configureAppTestEnvironment(url!)
    vi.stubEnv('CALENDZA_URL', 'https://staging.calendza.xyz')
    vi.stubEnv('BACHS_SECRET_KEY', 'sk_sandbox_regional_test')
    vi.stubEnv('BACHS_WEBHOOK_SECRET', 'whsec_regional_test')
    vi.stubEnv('SMTP_URL', 'smtp://127.0.0.1:1025')
    vi.stubEnv('EMAIL_FROM', 'Calendza Tests <test@example.com>')
    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => (
      Object.assign(new Error(input.statusMessage), input)
    ))
    const { resetEnv } = await import('@@/server/config/env')
    resetEnv()
    requests = []
    provider()
  })

  afterEach(async () => {
    if (organizationIds.length) await sql`delete from organizations where id in ${sql(organizationIds)}`
    if (userIds.length) {
      await sql`delete from security_audit_logs where actor_user_id in ${sql(userIds)}`
      await sql`delete from users where id in ${sql(userIds)}`
    }
    organizationIds.length = 0
    userIds.length = 0
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    const { resetEnv } = await import('@@/server/config/env')
    resetEnv()
  })

  afterAll(async () => {
    await sql.end()
  })

  describe.each<Plan>(['personal', 'team'])('%s plan', (plan) => {
    it.each<BillingInterval>(['monthly', 'yearly'])('stores and charges the fixed NGN price for %s checkout without FX', async (interval) => {
      const account = await fixture(plan)
      const result = await account.checkout('NGN', interval)
      const [invoice] = await sql`select * from ${sql(account.invoices)} where reference = ${result.reference}`
      const [subscription] = await sql`select * from ${sql(account.subscriptions)} where ${sql(account.ownerColumn)} = ${account.ownerId}`
      const checkout = requests.find(request => request.path.endsWith('/checkout-sessions'))!
      const expectedAmount = plan === 'personal'
        ? interval === 'monthly' ? '7500.00' : '75000.00'
        : interval === 'monthly' ? '20000.00' : '200000.00'
      const baseCents = (plan === 'personal' ? 600 : 1600) * (interval === 'yearly' ? 10 : 1)

      expect(requests.some(request => request.path.endsWith('/conversions/quotes'))).toBe(false)
      expect(checkout.body.pricing).toEqual({ amount: expectedAmount, currency: 'NGN', price_type: 'fixed' })
      expect(checkout.body.payment_method_options).toEqual({ bank_transfer: { currencies: ['NGN'] }, card: { currencies: ['NGN'] } })
      expect(checkout.body).not.toHaveProperty('product_cart')
      expect(checkout.body.metadata).not.toHaveProperty('rate')
      expect(invoice).toMatchObject({
        amount_cents: baseCents, collection_amount: expectedAmount, collection_currency: 'NGN',
        exchange_rate: null, status: 'pending', bachs_checkout_id: 'checkout_regional_test'
      })
      expect(subscription).toMatchObject({ collection_currency: 'NGN', collection_method: 'invoice', interval })
      expect(subscription?.status).not.toBe('active')
    })

    it('keeps the fixed price on a failed checkout without activating paid access', async () => {
      const account = await fixture(plan)
      provider({ checkoutFailure: true })
      await expect(account.checkout()).rejects.toMatchObject({ statusCode: 503 })
      const [invoice] = await sql`select * from ${sql(account.invoices)} where ${sql(account.ownerColumn)} = ${account.ownerId}`
      expect(invoice).toMatchObject({ status: 'failed', collection_currency: 'NGN', exchange_rate: null, bachs_checkout_id: null })
      expect(invoice?.collection_amount).toBe(plan === 'personal' ? '7500.00' : '20000.00')
      const [subscription] = await sql`select * from ${sql(account.subscriptions)} where ${sql(account.ownerColumn)} = ${account.ownerId}`
      expect(subscription?.status).not.toBe('active')
    })

    it('keeps USD checkout recurring and avoids requesting an exchange quote', async () => {
      const account = await fixture(plan)
      const result = await account.checkout('USD')
      const checkout = requests.find(request => request.path.endsWith('/checkout-sessions'))!
      expect(requests.some(request => request.path.endsWith('/conversions/quotes'))).toBe(false)
      expect(checkout.body).toMatchObject({ billing_currency: 'USD', product_cart: [{ product_id: plan === 'personal' ? 'prod_personal' : 'prod_team', quantity: 1 }] })
      const [invoice] = await sql`select * from ${sql(account.invoices)} where reference = ${result.reference}`
      expect(invoice).toMatchObject({ collection_currency: 'USD', collection_amount: plan === 'personal' ? '6.00' : '16.00', exchange_rate: null })
    })

    it('does not replace an active USD subscription with NGN billing', async () => {
      const account = await fixture(plan)
      if (plan === 'personal') {
        await sql`insert into personal_subscriptions (user_id, status) values (${account.userId}, 'canceled')`
      }
      await sql`update ${sql(account.subscriptions)} set status = 'active', collection_currency = 'USD',
        collection_method = 'charge_automatically', bachs_subscription_id = 'sub_existing_usd',
        current_period_end = now() + interval '1 month'
        where ${sql(account.ownerColumn)} = ${account.ownerId}`
      if (plan === 'team') {
        await sql`update organization_subscriptions set seats_at_last_invoice = 2 where organization_id = ${account.ownerId}`
      }
      const [before] = await sql`select * from ${sql(account.subscriptions)} where ${sql(account.ownerColumn)} = ${account.ownerId}`
      await expect(account.checkout()).rejects.toMatchObject({ statusCode: 409 })
      const [after] = await sql`select * from ${sql(account.subscriptions)} where ${sql(account.ownerColumn)} = ${account.ownerId}`
      expect(after).toEqual(before)
      expect(requests).toEqual([])
    })

    it.each<CollectionCurrency>(['USD', 'NGN'])('does not reprice an earlier paid %s invoice when opening a fixed NGN checkout', async (currency) => {
      const account = await fixture(plan)
      const earlier = await account.checkout('USD')
      await sql`update ${sql(account.invoices)} set status = 'paid', paid_at = now(), bachs_charge_id = 'charge_historical'
        where reference = ${earlier.reference}`
      if (currency === 'NGN') {
        await sql`update ${sql(account.invoices)} set collection_currency = 'NGN',
          collection_amount = ${plan === 'personal' ? '8129.66' : '21679.10'},
          exchange_rate = '1354.9437' where reference = ${earlier.reference}`
      }
      const [before] = await sql`select * from ${sql(account.invoices)} where reference = ${earlier.reference}`
      await account.checkout('NGN')
      const [after] = await sql`select * from ${sql(account.invoices)} where reference = ${earlier.reference}`
      expect(after).toEqual(before)
    })
  })

  it('reuses a personal checkout with its original fixed NGN price on a retry', async () => {
    const account = await fixture('personal')
    const requestId = crypto.randomUUID()
    const first = await account.checkout('NGN', 'monthly', requestId)
    const requestCount = requests.length
    const retry = await account.checkout('NGN', 'monthly', requestId)
    expect(retry).toEqual(first)
    expect(requests).toHaveLength(requestCount)
    const invoices = await sql`select * from personal_invoices where user_id = ${account.userId}`
    expect(invoices).toHaveLength(1)
    expect(invoices[0]?.collection_amount).toBe('7500.00')
  })
})
