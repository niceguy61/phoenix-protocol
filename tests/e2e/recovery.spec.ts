import { expect, test } from '@playwright/test';

test('resolves a public repository and renders the pinned snapshot', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Prove your infrastructure can rise again.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source snapshot' })).toBeVisible();

  await page.getByRole('button', { name: 'Resolve source snapshot' }).click();

  await expect(page.getByRole('status')).toContainText('Snapshot pinned.', { timeout: 30_000 });
  await expect(page.getByRole('status')).toContainText('niceguy61/phoenix-protocol');
});

test('renders an actionable API error state', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('GitHub repository').fill('https://example.invalid/not-a-repository');
  await page.getByRole('button', { name: 'Resolve source snapshot' }).click();

  await expect(page.locator('.message.error')).toContainText('public GitHub repository', { timeout: 10_000 });
});
