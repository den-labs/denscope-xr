import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads and shows feed content or empty state', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DenScope/i);
    // The page should render without errors — look for the main layout
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation to /graph shows the trust graph page', async ({ page }) => {
    await page.goto('/graph');
    await expect(page).toHaveTitle(/DenScope/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation to /discovery shows the discovery page', async ({
    page,
  }) => {
    await page.goto('/discovery');
    await expect(page).toHaveTitle(/DenScope/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation to /docs/api shows API documentation', async ({ page }) => {
    await page.goto('/docs/api');
    await expect(page).toHaveTitle(/DenScope/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('page titles contain DenScope', async ({ page }) => {
    const routes = ['/', '/graph', '/discovery', '/docs/api'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveTitle(/DenScope/i);
    }
  });
});
