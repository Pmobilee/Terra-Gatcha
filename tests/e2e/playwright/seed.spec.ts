import { expect, test } from '@playwright/test'

test('app loads and starts onboarding without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  expect(runtimeErrors).toEqual([])
})
