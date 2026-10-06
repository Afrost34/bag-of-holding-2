import { expect, test } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Entity pages, links and rolls, on the fixture dataset (GitHub mocked, 3D dice off). */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.addInitScript(() => {
    localStorage.setItem('boh.dice', JSON.stringify({ state: { threeD: false }, version: 1 }));
  });
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

test('search opens an entity page with a working roll', async ({ page }) => {
  await page.goto('./#/compendium');
  await page.getByLabel('Search the compendium').fill('goblin boss');
  await page.getByRole('link', { name: /Goblin Boss/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Goblin Boss' })).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Goblin Boss/);
  // The copy resolved: the boss has the goblin's scimitar plus its own multiattack.
  await expect(page.getByText('Multiattack.')).toBeVisible();

  await page.getByRole('button', { name: '+4', exact: true }).first().click();
  const results = page.getByRole('list', { name: 'Roll results' });
  await expect(results.getByText(/1d20 \+ 4 →/)).toBeVisible();
});

test('rolls from the dice tray land in the session log', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Dice tray' }).click();
  await page.getByRole('button', { name: 'Add d20' }).click();
  await page.getByRole('button', { name: 'Increase modifier' }).click();
  await page.getByRole('radio', { name: 'advantage', exact: true }).click();
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Roll results' }).getByText(/1d20 \+ 1 → \[/),
  ).toBeVisible();

  await page.getByRole('button', { name: /Log \(1\)/ }).click();
  await expect(page.getByText('Dice tray').last()).toBeVisible();
});
