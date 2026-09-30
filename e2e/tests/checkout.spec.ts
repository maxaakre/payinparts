import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
});

test('customer splits a payment and confirms the order', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Demo — no real payments/)).toBeVisible();

  await page.getByRole('link', { name: 'Choose' }).first().click(); // headphones
  await page.getByLabel('Split into 3 months').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/orders\//);

  // Refreshing a deep link must still load the app
  await page.reload();
  await expect(page.getByText('Total cost')).toBeVisible();

  await page.getByLabel('Test customer').selectOption('anna');
  await page.getByRole('button', { name: 'Run credit check' }).click();
  await expect(page.getByText('Approved!')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByRole('heading', { name: /Order confirmed/ })).toBeVisible();
});

test('declined customer is offered pay now', async ({ page }) => {
  await page.goto('/checkout/headphones');
  await page.getByLabel('Split into 3 months').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Test customer').selectOption('olle');
  await page.getByRole('button', { name: 'Run credit check' }).click();
  await expect(page.getByRole('button', { name: 'Pay now instead' })).toBeVisible();
});

test('unknown order shows a friendly message', async ({ page }) => {
  await page.goto('/orders/does-not-exist');
  await expect(page.getByText('We could not find that order.')).toBeVisible();
});
