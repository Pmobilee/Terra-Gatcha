import { expect, test } from '@playwright/test'

test('library and settings screens are reachable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)

  await page.getByRole('button', { name: 'Knowledge Library' }).click()
  await expect(page.getByRole('heading', { name: 'Knowledge Library' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Back' }).click()

  await page.getByRole('button', { name: 'Open Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Accessibility')).toBeVisible()
})
