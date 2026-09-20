import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import { makeSignature } from 'better-auth/crypto'
import type { PaymentSummary, PaymentWithdrawalOptions, PaymentWithdrawalRecord } from '@/services/api/payments'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for Playwright tests.')
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
const username = `payment-display-${crypto.randomUUID().slice(0, 8)}`
const email = `${username}@calendza.test`
const token = crypto.randomUUID()
const teamSlug = `${username}-team`

test.use({ colorScheme: 'dark' })

test.beforeAll(async () => {
  await sql.begin(async (transaction) => {
    const [user] = await transaction`insert into users (name, username, email, email_verified, time_zone)
      values ('Payment display test', ${username}, ${email}, true, 'Africa/Lagos') returning id`
    await transaction`insert into sessions (user_id, token, expires_at)
      values (${user!.id}, ${token}, now() + interval '1 hour')`
    const [team] = await transaction`insert into organizations (name, slug)
      values ('Payment display team', ${teamSlug}) returning id`
    await transaction`insert into members (organization_id, user_id, role)
      values (${team!.id}, ${user!.id}, 'owner')`
  })
})

test.afterAll(async () => {
  await sql`delete from organizations where slug = ${teamSlug}`
  await sql`delete from users where email = ${email}`
  await sql.end()
})

test.beforeEach(async ({ context }) => {
  await sql`update users set preferred_currency = 'NGN' where email = ${email}`
  // Match the isolated Playwright server's secret without consuming sign-in rate limits.
  const signature = await makeSignature(token, 'playwright-only-secret-with-at-least-thirty-two-characters')
  await context.addCookies([{
    name: 'better-auth.session_token', value: encodeURIComponent(`${token}.${signature}`),
    domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax'
  }])
})

function withdrawal(status: PaymentWithdrawalRecord['status']): PaymentWithdrawalRecord {
  return {
    id: status, status, destinationName: 'Primary bank', sourceCurrency: 'USD', destinationCurrency: 'NGN',
    requestedAmountCents: 100, deliveredAmountCents: 137529, feeCents: 100, totalDebitedCents: 200,
    failureReason: status === 'failed' ? 'Insufficient balance.' : null, providerPayoutId: null,
    createdAt: '2026-08-30T01:52:00Z', completedAt: status === 'completed' ? '2026-08-30T01:53:00Z' : null
  }
}

function summary(): PaymentSummary {
  return {
    collected: [{ currency: 'USD', amountCents: 300 }],
    available: [{ currency: 'NGN', amountCents: 0 }, { currency: 'USD', amountCents: 85 }],
    pending: [{ currency: 'NGN', amountCents: 0 }, { currency: 'USD', amountCents: 0 }],
    withdrawn: [{ currency: 'NGN', amountCents: 137529 }],
    providerStatus: 'available', updatedAt: '2026-08-30T01:53:00Z'
  }
}

async function openPayments(page: Page, totals: PaymentSummary, withdrawals: PaymentWithdrawalRecord[] = [], team = false) {
  await page.route('**/api/payment-display-rates', route => route.fulfill({ json: [
    { from: 'USD', to: 'NGN', rate: '1500', quotedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() },
    { from: 'NGN', to: 'USD', rate: '0.00065', quotedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() }
  ] }))
  const prefix = team ? `/api/teams/${teamSlug}` : '/api'
  await page.route(`**${prefix}/payment-account`, route => route.fulfill({ json: {
    configured: true, status: 'active', ready: true, nextAction: 'none', lastError: null,
    lastCheckedAt: totals.updatedAt, platformFeeBps: 100
  } }))
  await page.route(`**${prefix}/payment-summary`, route => route.fulfill({ json: totals }))
  const options: PaymentWithdrawalOptions = {
    ready: true, status: 'active', available: totals.available,
    destinations: [{ id: 'bank-1', name: 'Primary bank', type: 'bank_account', currency: 'NGN', isDefault: true }],
    withdrawals
  }
  await page.route(`**${prefix}/payment-withdrawals`, route => route.fulfill({ json: options }))
  await page.route(`**${prefix}/payment-activity*`, route => route.fulfill({ json: {
    items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
  } }))
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  if (team) {
    await page.getByRole('button', { name: /Current team: Personal/ }).click()
    await page.getByRole('menuitem', { name: /Payment display team/ }).click()
    await expect(page).toHaveURL(new RegExp(`/t/${teamSlug}/members$`))
  }
  await page.getByRole('link', { name: 'Payments', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payment summary', exact: true })).toBeVisible()
  await expect(page.getByText('Paid bookings enabled', { exact: true })).toBeVisible()
}

test('converts USD balances into the selected display currency without changing payouts', async ({ page }) => {
  test.setTimeout(90_000)
  const statuses: PaymentWithdrawalRecord['status'][] = ['completed', 'failed', 'unknown', 'creating', 'pending', 'processing']
  await openPayments(page, summary(), statuses.map(withdrawal))
  const totals = page.getByRole('region', { name: 'Payment summary' })
  await expect(totals.getByText('≈ NGN 1,275.00', { exact: true })).toBeVisible()
  await expect(totals.getByText('≈ NGN 4,500.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Show popup' }).first()).toHaveText('$0.85 available')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await chooseCurrency(page, 'USD')
  await expect(totals.getByText('$3.00', { exact: true })).toBeVisible()
  await expect(totals.getByText('$0.85', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Display currency' })).toHaveText('USD')
  await expect(page.getByRole('region', { name: 'Payout history' }).getByText('≈ $0.89', { exact: true }).first()).toBeVisible()
  await expect(totals.getByText('None pending', { exact: true })).toBeVisible()
  await expect(page.getByText('NGN 0.00', { exact: true })).toHaveCount(0)
  await expect(page.getByText('$0.00', { exact: true })).toHaveCount(0)
  const failed = page.getByRole('listitem').filter({ has: page.getByText('Failed', { exact: true }) })
  await expect(failed.getByText('Quoted bank amount:', { exact: true })).toBeVisible()
  await expect(failed.getByText('Withdrawal total · USD', { exact: true })).toBeVisible()
  await expect(failed.getByText(/deducted|Expected at bank/)).toHaveCount(0)
  await expect(page.getByText('Total deducted · USD', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Quoted bank amount:', { exact: true })).toHaveCount(3)
  await expect(page.getByText('Expected at bank:', { exact: true })).toHaveCount(2)
  for (const width of [1280, 768, 360]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/calendza-payment-display-${width}.png`, fullPage: true })
  }
})

test('preserves real balances in both currencies and never labels an unknown bank amount as paid', async ({ page }) => {
  const totals = summary()
  totals.available = [{ currency: 'NGN', amountCents: 750000 }, { currency: 'USD', amountCents: 85 }]
  totals.pending = [{ currency: 'USD', amountCents: -100 }]
  totals.withdrawn = []
  await openPayments(page, totals, [{ ...withdrawal('completed'), deliveredAmountCents: null }])
  const panel = page.getByRole('region', { name: 'Payment summary' })
  await expect(panel.getByText('≈ NGN 8,775.00', { exact: true })).toBeVisible()
  await chooseCurrency(page, 'USD')
  await expect(panel.getByText('≈ $5.73', { exact: true })).toBeVisible()
  await expect(panel.getByText('-$1.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Payout history' }).getByText('No payouts yet', { exact: true })).toBeVisible()
  await expect(page.getByText('Requested withdrawal:', { exact: true })).toBeVisible()
  await expect(page.getByText('Paid to bank:', { exact: true })).toHaveCount(0)
  await chooseCurrency(page, 'NGN')
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Withdraw funds', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Show popup' }).first()).toHaveText('NGN 7,500.00 available')
})

test('shows an empty account without guessing its currency', async ({ page }) => {
  const totals = summary()
  totals.collected = []
  totals.available = [{ currency: 'NGN', amountCents: 0 }, { currency: 'USD', amountCents: 0 }]
  totals.withdrawn = []
  await openPayments(page, totals)
  for (const label of ['No payments yet', 'None pending', 'No payouts yet', 'No settled balance yet']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeDisabled()
  await expect(page.getByText('NGN 0.00', { exact: true })).toHaveCount(0)
  await expect(page.getByText('$0.00', { exact: true })).toHaveCount(0)
})

test('does not present unavailable provider totals as zero', async ({ page }) => {
  const totals = { ...summary(), available: [], pending: [], withdrawn: [], providerStatus: 'unavailable' as const }
  await openPayments(page, totals)
  await expect(page.getByRole('region', { name: 'Payment summary' }).getByText('Unavailable', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Bank payout totals unavailable. Refresh the payment summary to try again.', { exact: true })).toBeVisible()
  await expect(page.getByText('No payouts yet', { exact: true })).toHaveCount(0)
})

async function chooseCurrency(page: Page, currency: 'USD' | 'NGN') {
  await page.getByRole('combobox', { name: 'Display currency' }).click()
  await page.getByRole('option', { name: currency, exact: true }).click()
}

test('keeps the selected display currency even when funds are held in another currency', async ({ page }) => {
  const totals = summary()
  totals.available = [{ currency: 'NGN', amountCents: 750000 }, { currency: 'USD', amountCents: 85 }]
  await openPayments(page, totals)
  await chooseCurrency(page, 'USD')
  const panel = page.getByRole('region', { name: 'Payment summary' })
  totals.available[1]!.amountCents = 99
  await page.getByRole('button', { name: 'Refresh payment summary' }).click()
  await expect(panel.getByText('≈ $5.87', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Display currency' })).toHaveText('USD')
  totals.available[1]!.amountCents = 0
  totals.collected = []
  await page.getByRole('button', { name: 'Refresh payment summary' }).click()
  await expect(panel.getByText('≈ $4.88', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Display currency' })).toHaveText('USD')
})

test('keeps a negative balance discoverable and blocks withdrawing from another currency', async ({ page }) => {
  const totals = summary()
  totals.available = [{ currency: 'NGN', amountCents: 750000 }, { currency: 'USD', amountCents: -85 }]
  await openPayments(page, totals)
  await expect(page.getByRole('alert').filter({ hasText: 'One of your currency balances is negative' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeDisabled()
  await chooseCurrency(page, 'USD')
  await expect(page.getByRole('region', { name: 'Payment summary' }).getByText('≈ $4.03', { exact: true })).toBeVisible()
})

test('shows the team amounts and currency on its payments page', async ({ page }) => {
  const totals = summary()
  totals.collected = [{ currency: 'NGN', amountCents: 800000 }]
  totals.available = [{ currency: 'NGN', amountCents: 750000 }]
  await openPayments(page, totals, [], true)
  const panel = page.getByRole('region', { name: 'Payment summary' })
  await expect(panel.getByText('NGN 7,500.00', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(panel.getByText('NGN 8,000.00', { exact: true })).toBeVisible()
  await chooseCurrency(page, 'USD')
  await expect(panel.getByText('≈ $4.88', { exact: true })).toBeVisible()
})

test('does not show stale money as current after a failed refresh', async ({ page }) => {
  await openPayments(page, summary())
  await page.route('**/api/payment-summary', route => route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } }))
  await page.getByRole('button', { name: 'Refresh payment summary' }).click()
  const panel = page.getByRole('region', { name: 'Payment summary' })
  await expect(panel.getByText('Could not load payment totals', { exact: true })).toBeVisible()
  await expect(panel.getByText('$0.85', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Bank payout totals unavailable. Refresh the payment summary to try again.', { exact: true })).toBeVisible()
  await page.route('**/api/payment-withdrawals', route => route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } }))
  await page.getByRole('button', { name: 'Refresh withdrawal status' }).click()
  await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeDisabled()
  await expect(page.getByText('Could not load payout history', { exact: true })).toBeVisible()
})

test('uses the actual withdrawal result in notifications without claiming early delivery', async ({ page }) => {
  test.setTimeout(60_000)
  await openPayments(page, summary())
  let result: PaymentWithdrawalRecord['status'] = 'failed'
  await page.route('**/api/payment-withdrawals/preview', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ destinationId: 'bank-1', sourceCurrency: 'USD', amountCents: 25 })
    await route.fulfill({ json: {
      confirmationToken: 'test-confirmation-token-not-sent-to-bachs',
      sourceCurrency: 'USD', destinationCurrency: 'NGN', requestedAmountCents: 25,
      deliveredAmountCents: 34382, feeCents: 25, totalDebitedCents: 50,
      exchangeRate: '1375.28', expiresAt: new Date(Date.now() + 600_000).toISOString(),
      destination: { id: 'bank-1', name: 'Primary bank', type: 'bank_account', currency: 'NGN', isDefault: true }
    } })
  })
  await page.route('**/api/payment-withdrawals', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    expect(route.request().postDataJSON()).toMatchObject({ confirmationToken: 'test-confirmation-token-not-sent-to-bachs' })
    await route.fulfill({ json: {
      ...withdrawal(result), requestedAmountCents: 25, deliveredAmountCents: 34382, feeCents: 25, totalDebitedCents: 50
    } })
  })
  const cases = [
    ['failed', 'Withdrawal failed'],
    ['unknown', 'Withdrawal is being verified'],
    ['pending', 'Withdrawal submitted'],
    ['completed', 'Withdrawal paid']
  ] as const
  for (const [status, title] of cases) {
    result = status
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
    await page.getByRole('textbox', { name: /Withdrawal amount/ }).fill('0.25')
    await page.getByRole('button', { name: 'Review withdrawal', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirm withdrawal', exact: true })
    await expect(dialog.getByText('Bank will receive', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Total to deduct from balance', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirm withdrawal', exact: true }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }
})
