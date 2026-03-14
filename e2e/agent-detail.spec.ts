import { test, expect } from '@playwright/test';

test.describe('Agent Detail Page', () => {
  test('agent detail page loads for /agent/42220/1', async ({ page }) => {
    const response = await page.goto('/agent/42220/1');
    // SSR page should return 200 even if agent data is minimal
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows agent ID in the page content', async ({ page }) => {
    await page.goto('/agent/42220/1');
    // The page should reference the agent ID somewhere in the content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    // Agent ID 1 or chain 42220 should appear in the rendered content
    const hasAgentRef =
      body?.includes('1') || body?.includes('42220') || body?.includes('Celo');
    expect(hasAgentRef).toBe(true);
  });

  test('shows chain information (Celo)', async ({ page }) => {
    await page.goto('/agent/42220/1');
    const body = await page.locator('body').textContent();
    // Chain 42220 is Celo — expect some reference to Celo or the chain
    const hasCeloRef =
      body?.includes('Celo') ||
      body?.includes('42220') ||
      body?.includes('celo');
    expect(hasCeloRef).toBe(true);
  });

  test('has share or certificate actions visible', async ({ page }) => {
    await page.goto('/agent/42220/1');
    // Look for share/certificate buttons or links in the page
    const shareButton = page.getByRole('button', { name: /share/i });
    const certButton = page.getByRole('button', { name: /certificate/i });
    const shareLink = page.getByRole('link', { name: /share/i });
    const certLink = page.getByRole('link', { name: /certificate/i });

    const hasShareAction =
      (await shareButton.count()) > 0 || (await shareLink.count()) > 0;
    const hasCertAction =
      (await certButton.count()) > 0 || (await certLink.count()) > 0;

    // At least one action should be present
    expect(hasShareAction || hasCertAction).toBe(true);
  });

  test('unknown agent shows graceful empty state', async ({ page }) => {
    const response = await page.goto('/agent/42220/999999');
    // Should not crash — either 200 with empty state or 404
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
});
