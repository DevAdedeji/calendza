import { expect, test } from '@playwright/test'

test('shows Calendza branding and keeps public pages usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/pricing', '/support', '/signup', '/login', '/docs/integrations/zoom']) {
    await page.goto(path)
    await expect(page).toHaveTitle(/Calendza/)
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Calendza')
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow, `${path} should fit a mobile viewport`).toBe(false)
  }
  await page.goto('/support')
  await expect(page.locator('a[href="mailto:support@calendza.xyz"]').first()).toBeVisible()
})

for (const mode of ['personal', 'floating']) {
  test(`opens and closes Calendza ${mode} embeds`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:3103/${mode}`)
    await page.waitForFunction(() => {
      const scope = window as Window & { CalendzaEmbed?: unknown, Calendza?: unknown }
      return Boolean(scope.CalendzaEmbed) && scope.CalendzaEmbed === scope.Calendza
    })
    const button = page.getByRole('button', { name: mode === 'floating' ? 'Book now' : 'Book a demo' })
    await button.click()
    const overlay = page.locator('[data-calendza-overlay]')
    await expect(overlay).toBeVisible()
    await expect(overlay.locator('iframe')).toHaveAttribute('title', 'Book a meeting')
    await expect(overlay.locator('iframe')).toHaveAttribute('src', /\/embed\/personal\//)
    await overlay.getByRole('button', { name: 'Close booking' }).click()
    await expect(overlay).toHaveCount(0)
    await expect(button).toBeFocused()
    const events = await page.evaluate(() => (window as Window & {
      embedEvents: Array<{ type: string }>
    }).embedEvents.map(event => event.type))
    expect(events.filter(event => event === 'open')).toHaveLength(1)
    expect(events.filter(event => event === 'close')).toHaveLength(1)
  })
}
