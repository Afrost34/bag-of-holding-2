import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Compendium lists on the fixture dataset: browse, filter via chips, sort, open entries. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('browse spells, filter and open one', async ({ page }) => {
  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Browse' })
    .getByRole('link', { name: /Spells/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Spells' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Spells list' });
  await expect(table.getByRole('row')).toHaveCount(4); // header + 3 spells

  const filters = page.getByRole('complementary', { name: 'Filters' });
  if (!(await filters.isVisible())) await page.getByRole('button', { name: 'Filters' }).click();
  await filters.getByRole('group', { name: 'Level' }).getByRole('button', { name: /^1/ }).click();
  await expect(page.getByText('1 spell', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Level: 1/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Close filters' }).isVisible()) {
    await page.getByRole('button', { name: 'Close filters' }).click();
  }

  await table.getByRole('row', { name: /Magic Missile/ }).click();
  const isPhone = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isPhone) {
    await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();
  } else {
    await expect(
      page.getByRole('complementary', { name: 'Selected entry' }).getByText('Magic Missile'),
    ).toBeVisible();
  }
});

test('filters survive a reload because they live in the URL', async ({ page }) => {
  await page.goto('./#/compendium/list/spells?f.level=3&sort=name&dir=desc');
  await expect(page.getByText('2 spells', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 spells', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Level: 3/ })).toBeVisible();
});
