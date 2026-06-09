import { test, expect } from '@playwright/test'

// Structural assertions only — the snapshot derives from live data, so we verify
// the layout surfaces (radar, verdict, matrix, evidence) render rather than
// pinning a specific verdict/score. Celo mainnet agent #1 has indexed history.
const AGENT = '/agent/42220/1'

test.describe('Trust Snapshot — agent page', () => {
  test('renders without server error', async ({ page }) => {
    const res = await page.goto(AGENT)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
  })

  test('shows the trust radar as an accessible SVG', async ({ page }) => {
    await page.goto(AGENT)
    const radar = page.getByRole('img', { name: /Trust radar/i })
    await expect(radar).toBeVisible()
  })

  test('shows a verdict pill (one of the four states)', async ({ page }) => {
    await page.goto(AGENT)
    const verdict = page.getByText(
      /Ready to coordinate|Warming up|Caution|Insufficient data/
    ).first()
    await expect(verdict).toBeVisible()
  })

  test('renders the coordination matrix with badges and canonicality copy', async ({ page }) => {
    await page.goto(AGENT)
    await expect(page.getByText('A2A').first()).toBeVisible()
    await expect(page.getByText('OASF').first()).toBeVisible()
    await expect(
      page.getByText(/Dimensions interpret the score above — they do not replace it\./).first()
    ).toBeVisible()
  })

  test('expands the trust radar dimension to reveal its rule', async ({ page }) => {
    await page.goto(AGENT)
    await page.getByRole('button', { name: /Identity/i }).first().click()
    await expect(page.getByText(/metadata-presence|weighted/i).first()).toBeVisible()
  })

  test('mobile viewport keeps the snapshot usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const res = await page.goto(AGENT)
    expect(res?.status()).toBeLessThan(500)
    // Radar remains present and there is no horizontal overflow of the body.
    await expect(page.getByRole('img', { name: /Trust radar/i })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
    expect(overflow).toBe(true)
  })
})
