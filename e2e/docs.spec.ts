import { test, expect } from '@playwright/test';

test.describe('API Documentation Page', () => {
  test('/docs/api page loads', async ({ page }) => {
    const response = await page.goto('/docs/api');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/DenScope/i);
  });

  test('contains API documentation content', async ({ page }) => {
    await page.goto('/docs/api');
    const body = await page.locator('body').textContent();
    // The docs page should mention API-related terms
    const hasApiContent =
      body?.includes('API') ||
      body?.includes('endpoint') ||
      body?.includes('Endpoint') ||
      body?.includes('/api/');
    expect(hasApiContent).toBe(true);
  });

  test('has code examples visible', async ({ page }) => {
    await page.goto('/docs/api');
    // Look for code blocks (pre or code elements) on the docs page
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(0);
  });
});
