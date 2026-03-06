import { test, expect } from '@playwright/test';

test('app loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skipOnboarding=true&devpreset=post_tutorial');
  await expect(page.locator('[data-testid="btn-dive"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
