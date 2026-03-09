import { expect, test } from '@playwright/test'

test('onboarding enters combat', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)
  await page.getByTestId('btn-start-run').click()

  await expect(page.getByRole('button', { name: 'ENTER THE DEPTHS' })).toBeVisible()
  await page.getByRole('button', { name: 'ENTER THE DEPTHS' }).click()

  await expect(page.getByText('Do you prefer more time to read?')).toBeVisible()
  await page.getByRole('button', { name: 'No' }).click()

  await expect(page.locator('[data-screen="combat"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('btn-end-turn')).toBeVisible({ timeout: 20_000 })
})
