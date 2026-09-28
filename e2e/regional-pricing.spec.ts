import { expect, test } from '@playwright/test'
import postgres from 'postgres'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for Playwright tests.')
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

test.describe('Nigerian subscription pricing', () => {
  test.use({ timezoneId: 'Africa/Lagos' })

  test('uses USD even with a saved naira preference and Lagos time zone', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'billing-currency', value: 'NGN', url: baseURL! }])
    await page.goto('/pricing')
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Monthly', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    await expect(page.getByText('$8', { exact: true })).toBeVisible()
    await expect(page.getByText('Plans are billed in USD. Auto-renews until cancelled.', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Yearly', exact: true }).click()
    await expect(page.getByText('$60', { exact: true })).toBeVisible()
    await expect(page.getByText('$80', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 360, height: 800 })
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('does not depend on exchange-rate requests and keeps base-price metadata stable', async ({ page }) => {
    const pricingRequests: string[] = []
    await page.route('**/api/billing/pricing*', (route) => {
      pricingRequests.push(route.request().url())
      return route.abort()
    })
    await page.goto('/pricing')
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    expect(pricingRequests).toEqual([])
    const product = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(product.join('')).toContain('"priceCurrency":"USD"')
  })

  test('uses USD for new personal and team checkouts without converting invoice history', async ({ page }) => {
    test.setTimeout(120_000)
    const suffix = Date.now().toString(36)
    const username = `pricing-${suffix}`
    const email = `${username}@calendza.test`
    const password = 'a-production-grade-passphrase'
    await page.goto('/signup')
    await expect(page.getByTestId('signup-form')).toHaveAttribute('data-ready', 'true')
    await page.getByLabel('Your name').fill('Regional Pricing Test')
    await page.getByLabel('Your booking link').fill(username)
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await expect(page.getByText('Available', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Create my link' }).click()
    await expect(page).toHaveURL(/\/verify-email/)
    await sql`update users set email_verified = true where email = ${email}`
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/(dashboard|setup)$/)
    await page.goto('/billing')

    const historicalInvoice = {
      id: 'regional-history', reference: 'regional-history', status: 'paid', interval: 'monthly',
      amountCents: 600, collectionCurrency: 'NGN', collectionAmount: '9876.54',
      periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-02-01T00:00:00Z',
      paidAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z'
    }
    await page.route('**/api/billing', async (route) => {
      const response = await route.fetch()
      const summary = await response.json()
      await route.fulfill({ json: {
        ...summary,
        configured: true,
        invoices: [historicalInvoice, { ...historicalInvoice, id: 'legacy-naira-history', collectionAmount: null }]
      } })
    })
    let personalCheckout: { currency: string, interval: string } | undefined
    await page.route('**/api/billing/checkout', async (route) => {
      personalCheckout = route.request().postDataJSON()
      await route.fulfill({ status: 503, json: { message: 'Checkout stub: no charge made' } })
    })
    await page.getByRole('link', { name: 'Plan & billing', exact: true }).click()
    await expect(page.getByRole('heading', { name: /\$6/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: '₦9,876.54', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'NGN amount unavailable', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Upgrade to Personal Pro', exact: true }).click()
    await expect.poll(() => personalCheckout).toMatchObject({ currency: 'USD', interval: 'monthly' })
    await expect(page.getByRole('heading', { name: /\$6/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: '₦9,876.54', exact: true })).toBeVisible()

    await page.getByRole('button', { name: /Current team: Personal\. Switch team/ }).click()
    await page.getByText('Create team', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create a team' })
    await expect(dialog.getByText('14 days free. No card required.', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Paid plans are \$8 USD per member monthly/)).toBeVisible()
    await expect(dialog.getByText(/Starting a trial does not start a paid subscription/)).toHaveCount(0)
    await page.getByLabel('Team name').fill('Regional Team')
    await page.getByLabel('Team address').fill(username)
    await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Create team', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/t/${username}/members$`))

    let existingDollarSubscription = false
    await page.route(`**/api/teams/${username}/billing`, async (route) => {
      const response = await route.fetch()
      const summary = await response.json()
      await route.fulfill({ json: existingDollarSubscription
        ? {
            ...summary,
            configured: true,
            entitlement: { ...summary.entitlement, status: 'active', interval: 'yearly', nextInvoiceCents: 8000, autoRenews: true },
            seatBilling: { ...summary.seatBilling, billedSeats: 1, collectionCurrency: 'USD', collectionMethod: 'charge_automatically' }
          }
        : { ...summary, configured: true } })
    })
    let teamCheckout: { currency: string, interval: string } | undefined
    await page.route(`**/api/teams/${username}/billing/checkout`, async (route) => {
      teamCheckout = route.request().postDataJSON()
      await route.fulfill({ status: 503, json: { message: 'Checkout stub: no charge made' } })
    })
    await page.getByRole('link', { name: 'Billing', exact: true }).click()
    const checkout = page.getByRole('button', { name: 'Pay and activate · $8', exact: true })
    await expect(checkout).toBeEnabled()
    await checkout.click()
    await expect.poll(() => teamCheckout).toMatchObject({ currency: 'USD', interval: 'monthly' })
    existingDollarSubscription = true
    await page.getByRole('link', { name: 'Members', exact: true }).click()
    await page.getByRole('link', { name: 'Billing', exact: true }).click()
    await expect(page.getByText('$80', { exact: true })).toBeVisible()
    await expect(page.getByText('Card · USD', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveCount(0)
  })
})

test.describe('International subscription pricing', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('uses the same USD prices outside Nigeria', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
    await expect(page.getByText('$8', { exact: true })).toBeVisible()
    await expect(page.getByText('Pay in US dollars by card. Subscriptions renew automatically until cancelled.', { exact: true })).toHaveCount(0)
    await expect(page.getByText('$6', { exact: true })).toBeVisible()
  })
})
