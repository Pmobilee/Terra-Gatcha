import { expect, test } from '@playwright/test'

test('three-stage card commit flow works', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('btn-start-run').click()
  await page.getByRole('button', { name: 'ENTER THE DEPTHS' }).click()
  await page.getByRole('button', { name: 'No' }).click()

  await expect(page.getByTestId('card-hand-0')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('card-hand-0').click()

  await expect(page.getByTestId('btn-cast-card')).toBeVisible()
  await page.getByTestId('btn-cast-card').click()

  await expect(page.getByTestId('quiz-answer-0')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('quiz-answer-0').click()

  await expect(page.getByTestId('btn-end-turn')).toBeVisible()
})
