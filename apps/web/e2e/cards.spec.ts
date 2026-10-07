import { expect, test } from '@playwright/test';
import { installData } from './helpers/journal';

/** Card sheets: cards sent from the compendium, packed on A4 pages, arranged and printed. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

test('a spell sent from the compendium lands on a card sheet that prints', async ({ page }) => {
  // Send to → Cards → a new sheet, from the spell's page.
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New card sheet with Fireball/ }).click();
  await page.getByRole('status').getByRole('link').click();

  // The sheet: Fireball on page 1; add Magic Missile and a goblin.
  await expect(page.getByRole('list', { name: 'Cards in order' })).toContainText('Fireball');
  await expect(page.getByRole('region', { name: 'Page 1' }).first()).toContainText('Fireball');
  for (const [query, name] of [
    ['magic missile', 'Magic Missile'],
    ['goblin', 'Goblin'],
  ] as const) {
    await page.getByRole('searchbox', { name: 'Add a card' }).fill(query);
    await page
      .getByRole('list', { name: 'Found' })
      .getByRole('button', { name: new RegExp(name) })
      .first()
      .click();
  }
  const cards = page.getByRole('list', { name: 'Cards in order' });
  await expect(cards.getByRole('listitem')).toHaveCount(3);

  // The goblin starts a new page; Magic Missile is hidden.
  await page.getByRole('button', { name: 'Goblin starts a new page' }).click();
  await expect(page.getByRole('region', { name: 'Page 2' }).first()).toContainText('Goblin');
  await page.getByRole('button', { name: 'Hide Magic Missile' }).click();
  await expect(page.getByRole('region', { name: 'Page 1' }).first()).not.toContainText(
    'Magic Missile',
  );

  // Order changes the pages too.
  await page.getByRole('button', { name: 'Move Goblin up' }).click();
  await expect(cards.getByRole('listitem').nth(1)).toContainText('Goblin');

  // Printing shows the pages alone.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-root .sheet-page')).toHaveCount(2);

  // Kept after a reload.
  await page.emulateMedia({ media: 'screen' });
  await page.reload();
  await expect(
    page.getByRole('list', { name: 'Cards in order' }).getByRole('listitem'),
  ).toHaveCount(3);
});
