import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('search palette finds entries and pages', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Search (Ctrl+K)' }).click();
  const input = page.getByRole('combobox', { name: 'Search everything' });
  await input.fill('goblin b');
  await expect(page.getByRole('option', { name: /Goblin Boss/ })).toBeVisible();
  await input.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Goblin Boss' })).toBeVisible();

  await page.keyboard.press('Control+k');
  await input.fill('spells');
  await expect(page.getByRole('option', { name: /Browse Spells/ })).toBeVisible();
  await page.getByRole('option', { name: /Browse Spells/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Spells' })).toBeVisible();
});
