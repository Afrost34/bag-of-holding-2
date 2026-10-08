import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Class, subclass and species pages on the fixture dataset. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page
    .context()
    .route('https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/**', (r) => r.abort());
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('a class page shows traits, the class table, features and subclasses', async ({ page }) => {
  await page.goto('./#/compendium/list/classes');
  await page.getByRole('link', { name: 'View Bard details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bard' })).toBeVisible();

  const traits = page.getByRole('table', { name: 'Core Bard Traits' });
  await expect(traits.getByRole('row', { name: /Hit Point Die/ })).toContainText(
    'D8 per Bard level',
  );
  await expect(traits.getByRole('row', { name: /Saving Throw/ })).toContainText(
    'Dexterity and Charisma',
  );

  const table = page.getByRole('table', { name: 'The Bard table' });
  await expect(table.getByRole('row', { name: /^1st/ })).toContainText('Bardic Inspiration');
  await expect(table.getByRole('row', { name: /^4th/ })).toContainText('3');

  await expect(page.getByRole('heading', { name: 'Level 3: Bard College' })).toBeVisible();
  // Choosing a subclass at the top merges its features into the class's, at their levels.
  await page.getByRole('button', { name: 'Subclass: none chosen' }).first().click();
  await page.getByRole('button', { name: /College of Lore/ }).click();
  await expect(page).toHaveURL(/sc=subclass/);
  await expect(page.getByRole('heading', { name: /Level 3: College of Lore/ })).toBeVisible();
  // Features start folded; opening one shows its text.
  await page.getByRole('heading', { name: /Level 3: College of Lore/ }).click();
  await expect(page.getByText('Lore bards know something about most things.')).toBeVisible();
  await expect(table.getByRole('row', { name: /^3rd/ })).toContainText('College of Lore');

  await page.getByRole('link', { name: 'Open College of Lore' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'College of Lore' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bard', exact: true })).toBeVisible();
});

test('a species page shows its facts and subraces', async ({ page }) => {
  await page.goto('./#/compendium/race%3Aelf%40phb');
  await expect(page.getByRole('heading', { level: 1, name: 'Elf' })).toBeVisible();
  await expect(page.getByText('Dexterity +2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Elf (High)' })).toBeVisible();
  await expect(page.getByText('Intelligence +1')).toBeVisible();
});
