import { expect, test, type Page } from '@playwright/test';
import { mockGitHub, TAG } from './helpers/github';

/**
 * The data flow end to end, with GitHub replaced by the fixture dataset: download, sources,
 * search, persistence, homebrew and deletion. Never touches the network.
 */

async function search(page: Page, text: string) {
  await page.getByLabel('Search the data').fill(text);
  return page.getByRole('table', { name: 'Search results' });
}

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
});

test('downloads, searches, filters by source and survives a reload', async ({ page }) => {
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible({ timeout: 30_000 });

  const results = await search(page, 'fire');
  const phb = results.getByRole('row', { name: 'Fireball Spell PHB2014', exact: true });
  const xphb = results.getByRole('row', { name: 'Fireball Spell XPHB2024', exact: true });
  await expect(phb).toBeVisible();
  await expect(xphb).toBeVisible();

  // Turning off the 2014 core books hides their entries.
  await page.getByRole('button', { name: 'Turn off all Core rules (2014)' }).click();
  await expect(xphb).toBeVisible();
  await expect(phb).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible();
  await page.goto('./#/');
  // Data in: no sign about it in the top bar.
  await expect(page.getByRole('button', { name: /^5etools data/ })).toHaveCount(0);
});

test('imports homebrew and deletes downloaded data', async ({ page }) => {
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible({ timeout: 30_000 });

  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: 'Rust & Sunfire.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        _meta: { sources: [{ json: 'RustSunfire', full: 'Rust & Sunfire Homebrew' }] },
        item: [{ name: 'Ember Orb', source: 'RustSunfire', rarity: 'common' }],
      }),
    ),
  });
  await expect(page.getByText('rust-sunfire.json · 1 entries')).toBeVisible({ timeout: 15_000 });
  const results = await search(page, 'ember');
  await expect(results.getByRole('row', { name: /Ember Orb.*RustSunfire/ })).toBeVisible();

  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"spell": []}'),
  });
  await expect(page.getByRole('alert')).toContainText('Not a 5etools homebrew file');

  await page.getByRole('button', { name: 'Delete downloaded data' }).click();
  // Asked in the app, never in a browser pop-up.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Download 5etools data' })).toBeVisible();
});
