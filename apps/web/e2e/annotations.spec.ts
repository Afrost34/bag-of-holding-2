import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Bookmarks, personal notes, "Send to", random tables and tap-to-preview, on the fixture data. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.addInitScript(() => {
    localStorage.setItem('boh.dice', JSON.stringify({ state: { threeD: false }, version: 1 }));
  });
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('bookmark a page and keep a note on it, across reloads', async ({ page }) => {
  await page.goto('./#/compendium/spell%3Amagic%20missile%40phb');
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();

  await page.getByRole('button', { name: 'Bookmark' }).click();
  await expect(page.getByRole('button', { name: 'Bookmarked' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByLabel('Your note on Magic Missile').fill('Never misses. Use on the lich.');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Never misses. Use on the lich.')).toBeVisible();

  // Saved to the user's data: still there after a reload.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByText('Never misses. Use on the lich.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bookmarked' })).toBeVisible();

  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Bookmarks' })
    .getByRole('link', { name: 'Magic Missile' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();
});

test('"Send to" offers card sheets, boards and maps; encounters take creatures', async ({
  page,
}) => {
  await page.goto('./#/compendium/spell%3Amagic%20missile%40phb');
  await page.getByRole('button', { name: 'Send to' }).click();
  for (const name of [
    /New card sheet with Magic Missile/,
    /New board with Magic Missile/,
    /New map with Magic Missile/,
  ])
    await expect(page.getByRole('menuitem', { name })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: /Encounter/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('roll on a random table', async ({ page }) => {
  await page.goto('./#/compendium/table%3Awild%20surge%40phb');
  await page.getByRole('button', { name: /Roll 1d4 on/ }).click();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
  const results = page.getByRole('list', { name: 'Roll results' });
  await expect(results.getByText(/1d4 →/)).toBeVisible();
});

test('on a touch screen, a link opens a preview first', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch only');
  await page.goto('./#/compendium/table%3Awild%20surge%40phb');
  await page.getByRole('link', { name: 'Magic Missile' }).tap();
  const preview = page.getByRole('dialog', { name: 'Preview' });
  await expect(preview.getByRole('heading', { name: 'Magic Missile' })).toBeVisible();
  await preview.getByRole('link', { name: 'Open page' }).tap();
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();
});
