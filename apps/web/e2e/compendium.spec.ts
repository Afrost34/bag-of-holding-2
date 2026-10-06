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

test('dice tray: pick dice, advantage via right-click, roll everything', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Dice', exact: true }).click();
  await page.getByRole('button', { name: 'Add d6' }).click();
  await page.getByRole('button', { name: 'Add d6' }).click();
  await page.getByRole('button', { name: 'Add d20' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add with advantage' }).click();
  await page.getByRole('button', { name: 'Increase modifier' }).click();
  await expect(page.getByTestId('dice-pool')).toHaveText('d20 (adv) + 2d6 + 1');

  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  const results = page.getByRole('list', { name: 'Roll results' });
  await expect(results.getByText(/2d20kh1 \+ 2d6 \+ 1 → \[/)).toBeVisible();
  // The pool empties and the column closes after a roll.
  await expect(page.getByTestId('dice-pool')).toHaveCount(0);

  await page.getByRole('button', { name: 'Dice', exact: true }).click();
  await page.getByRole('button', { name: 'Roll log' }).click();
  await expect(page.getByText('Rolls this session (1)')).toBeVisible();
});

test('clicking a roll just rolls; right-click offers advantage', async ({ page }) => {
  await page.goto('./#/compendium');
  await page.getByLabel('Search the compendium').fill('goblin boss');
  await page.getByRole('link', { name: /Goblin Boss/ }).click();

  const chip = page.getByRole('button', { name: '+4', exact: true }).first();
  await chip.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  const results = page.getByRole('list', { name: 'Roll results' });
  await expect(results.getByText(/1d20 \+ 4 →/)).toBeVisible();

  await chip.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Roll with advantage' }).click();
  await expect(results.getByText('Adv').first()).toBeVisible();
});
