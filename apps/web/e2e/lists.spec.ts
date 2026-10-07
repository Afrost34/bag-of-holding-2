import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Compendium browsing on the fixture dataset: row lists with filters, and art card pages. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  // Card art comes from the 5etools image repository; keep tests offline.
  await page
    .context()
    .route('https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/**', (r) => r.abort());
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('browse spells, filter, and expand one in place', async ({ page }) => {
  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Browse' })
    .getByRole('link', { name: 'Spells' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Spells' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Spells list' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  // The 2014 Fireball was reprinted in 2024: it carries a Legacy badge and sorts after it.
  await expect(list.getByRole('listitem').filter({ hasText: 'Legacy' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Level', exact: true }).click();
  await page.getByRole('checkbox', { name: /^1st/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 spell', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level', exact: true })).toHaveText(/1st/);

  await list.getByRole('button', { name: /Magic Missile/ }).click();
  await expect(list.getByRole('button', { name: /Magic Missile/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('link', { name: 'View details page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();
});

test('filters and the expanded row survive a reload because they live in the URL', async ({
  page,
}) => {
  await page.goto('./#/compendium/list/spells?f.level=3&sort=name&dir=desc');
  await expect(page.getByText('2 spells', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 spells', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level', exact: true })).toHaveText(/3rd/);

  await page.getByRole('button', { name: 'Show advanced filters' }).click();
  await expect(page.getByRole('button', { name: 'Edition', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset all filters' }).click();
  await expect(page.getByText('3 spells', { exact: true })).toBeVisible();
});

test('classes show as art cards grouped by book', async ({ page }) => {
  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Browse' })
    .getByRole('link', { name: 'Classes' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Classes' })).toBeVisible();
  const book = page.getByRole('region', { name: "Player's Handbook (2014)" });
  await expect(book.getByRole('heading', { name: 'Bard' })).toBeVisible();
  await expect(book.getByText('An Inspiring Performer')).toBeVisible();
  await expect(book.getByText('D8')).toBeVisible();
  await expect(book.getByText('Dexterity & Charisma')).toBeVisible();

  await page.getByLabel('Search Classes').fill('wizard');
  await expect(page.getByText('No classes match “wizard”.')).toBeVisible();
  await page.getByLabel('Search Classes').fill('handbook');
  await page.getByRole('link', { name: 'View Bard details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bard' })).toBeVisible();
});
