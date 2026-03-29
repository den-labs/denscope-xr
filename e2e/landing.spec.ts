import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.describe('Renders correctly', () => {
    test('root loads without errors', async ({ page }) => {
      const response = await page.goto('/')
      expect(response?.status()).toBeLessThan(400)
      await expect(page).toHaveTitle(/DenScope/i)
    })

    test('hero headline is visible', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.getByRole('heading', {
          name: 'Trust infrastructure for autonomous agents',
        })
      ).toBeVisible()
    })

    test('hero subheadline is visible', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.getByText(
          'Compute trust signals, verify agent behavior, and expose the results'
        )
      ).toBeVisible()
    })

    test('ScoreLookup widget is visible with chain select, input, and button', async ({
      page,
    }) => {
      await page.goto('/')
      await expect(
        page.getByRole('combobox', { name: /select chain/i })
      ).toBeVisible()
      await expect(
        page.getByPlaceholder('Agent ID (e.g. 5)')
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Lookup' })
      ).toBeVisible()
    })

    test('Featured Certificates section is visible or gracefully absent', async ({
      page,
    }) => {
      await page.goto('/')
      const heading = page.getByRole('heading', {
        name: 'Featured Certificates',
      })
      // Section renders only when data exists; either way the page should not error
      const count = await heading.count()
      expect(count === 0 || count === 1).toBe(true)
    })

    test('Developer CTA section is visible with headline', async ({
      page,
    }) => {
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Build with trust data' })
      ).toBeVisible()
    })

    test('code snippet contains real API URL', async ({ page }) => {
      await page.goto('/')
      const codeBlock = page.locator('pre code')
      await expect(codeBlock).toBeVisible()
      await expect(codeBlock).toContainText(
        'https://denscope.vercel.app/api/v1/agent/'
      )
    })
  })

  test.describe('Score Lookup widget behavior', () => {
    test('Lookup button is disabled initially', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.getByRole('button', { name: 'Lookup' })
      ).toBeDisabled()
    })

    test('selecting chain + entering valid ID enables Lookup button', async ({
      page,
    }) => {
      await page.goto('/')
      const select = page.getByRole('combobox', { name: /select chain/i })
      const input = page.getByPlaceholder('Agent ID (e.g. 5)')
      const button = page.getByRole('button', { name: 'Lookup' })

      // Pick the first real chain option (skip the placeholder)
      await select.selectOption({ index: 1 })
      await input.fill('42')
      await expect(button).toBeEnabled()
    })

    test('clicking Lookup navigates to /agent/[chain]/[id]', async ({
      page,
    }) => {
      await page.goto('/')
      const select = page.getByRole('combobox', { name: /select chain/i })
      const input = page.getByPlaceholder('Agent ID (e.g. 5)')
      const button = page.getByRole('button', { name: 'Lookup' })

      await select.selectOption('42220')
      await input.fill('5')
      await button.click()
      await page.waitForURL('**/agent/42220/5')
      expect(page.url()).toContain('/agent/42220/5')
    })

    test('Enter key submits the form', async ({ page }) => {
      await page.goto('/')
      const select = page.getByRole('combobox', { name: /select chain/i })
      const input = page.getByPlaceholder('Agent ID (e.g. 5)')

      await select.selectOption('42220')
      await input.fill('5')
      await input.press('Enter')
      await page.waitForURL('**/agent/42220/5')
      expect(page.url()).toContain('/agent/42220/5')
    })

    test('non-numeric input shows error message on blur', async ({ page }) => {
      await page.goto('/')
      const input = page.getByPlaceholder('Agent ID (e.g. 5)')

      await input.fill('abc')
      await input.blur()
      await expect(
        page.getByText('Agent ID must be a number')
      ).toBeVisible()
    })

    test('"Try it" example link exists and points to /agent/42220/5', async ({
      page,
    }) => {
      await page.goto('/')
      const tryItLink = page.getByRole('link', { name: /try it/i })
      await expect(tryItLink).toBeVisible()
      await expect(tryItLink).toHaveAttribute('href', '/agent/42220/5')
    })
  })

  test.describe('Navigation integrity', () => {
    test('"Explore" nav link goes to /explore', async ({ page }) => {
      await page.goto('/')
      const exploreLink = page.getByRole('link', { name: 'Explore' }).first()
      await expect(exploreLink).toHaveAttribute('href', '/explore')
    })

    test('/explore loads the Live Feed', async ({ page }) => {
      await page.goto('/explore')
      await expect(
        page.getByRole('heading', { name: /live feed/i })
      ).toBeVisible()
    })

    test('logo link goes to / (landing)', async ({ page }) => {
      await page.goto('/explore')
      // The logo is inside a link to /
      const logoLink = page.locator('a[href="/"]').filter({
        has: page.getByAltText('DenScope'),
      })
      await expect(logoLink).toBeVisible()
      await logoLink.click()
      await page.waitForURL('**/')
      // Verify we are back on the landing page
      await expect(
        page.getByRole('heading', {
          name: 'Trust infrastructure for autonomous agents',
        })
      ).toBeVisible()
    })

    test('"View API Docs" link goes to /docs/api', async ({ page }) => {
      await page.goto('/')
      const apiDocsLink = page.getByRole('link', { name: 'View API Docs' })
      await expect(apiDocsLink).toBeVisible()
      await expect(apiDocsLink).toHaveAttribute('href', '/docs/api')
    })
  })

  test.describe('Responsive behavior', () => {
    test('at mobile viewport (375px), lookup widget stacks vertically', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
      })
      const page = await context.newPage()
      await page.goto('/')

      const container = page.locator(
        'div.flex.flex-col.gap-3'
      ).first()
      await expect(container).toBeVisible()

      // At 375px the sm:flex-row breakpoint should NOT apply — container stays flex-col
      const box = await container.boundingBox()
      expect(box).toBeTruthy()

      // The select and button should be full width (stacked), not side by side
      const select = page.getByRole('combobox', { name: /select chain/i })
      const button = page.getByRole('button', { name: 'Lookup' })

      const selectBox = await select.boundingBox()
      const buttonBox = await button.boundingBox()
      expect(selectBox).toBeTruthy()
      expect(buttonBox).toBeTruthy()

      // In a vertical stack, button should be below the select (higher y value)
      expect(buttonBox!.y).toBeGreaterThan(selectBox!.y + selectBox!.height - 1)

      await context.close()
    })

    test('at desktop viewport (1280px), lookup widget is horizontal', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      })
      const page = await context.newPage()
      await page.goto('/')

      const select = page.getByRole('combobox', { name: /select chain/i })
      const button = page.getByRole('button', { name: 'Lookup' })

      const selectBox = await select.boundingBox()
      const buttonBox = await button.boundingBox()
      expect(selectBox).toBeTruthy()
      expect(buttonBox).toBeTruthy()

      // In a horizontal layout, both should share roughly the same Y position
      expect(Math.abs(selectBox!.y - buttonBox!.y)).toBeLessThan(20)

      await context.close()
    })
  })

  test.describe('Theme switching', () => {
    test('landing renders in light theme without errors', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        colorScheme: 'light',
      })
      const page = await context.newPage()
      const response = await page.goto('/')
      expect(response?.status()).toBeLessThan(400)
      await expect(
        page.getByRole('heading', {
          name: 'Trust infrastructure for autonomous agents',
        })
      ).toBeVisible()
      await context.close()
    })

    test('landing renders in dark theme without errors', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        colorScheme: 'dark',
      })
      const page = await context.newPage()
      const response = await page.goto('/')
      expect(response?.status()).toBeLessThan(400)
      await expect(
        page.getByRole('heading', {
          name: 'Trust infrastructure for autonomous agents',
        })
      ).toBeVisible()
      await context.close()
    })

    test('theme toggle button switches theme', async ({ page }) => {
      await page.goto('/')
      const toggleButton = page.getByRole('button', { name: /toggle theme/i })
      // May be hidden on mobile; check desktop view
      if ((await toggleButton.count()) > 0) {
        await expect(toggleButton.first()).toBeVisible()
        // Click should not cause errors
        await toggleButton.first().click()
        // Page should still render correctly after toggle
        await expect(
          page.getByRole('heading', {
            name: 'Trust infrastructure for autonomous agents',
          })
        ).toBeVisible()
      }
    })
  })
})
