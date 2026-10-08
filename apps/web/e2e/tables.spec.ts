import { expect, test, type Page } from '@playwright/test';
import { createCampaign, installData, isPhone, newNote } from './helpers/journal';

/** Roll tables: random encounters for a region, loot and shops, linked to what they belong to. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

async function newTable(page: Page, name: string, kind: string) {
  await page.goto('./#/tables');
  await page.getByRole('button', { name: 'New table' }).click();
  const form = page.getByRole('form', { name: 'New table' });
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('Kind').selectOption({ label: kind });
  await form.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Table name' })).toHaveValue(name);
}

test('a region’s random encounter table rolls a fight into the encounter builder', async ({
  page,
}) => {
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/journal');
  await newNote(page, 'Cragmaw Woods');

  await newTable(page, 'Woods encounters', 'Random encounters');
  const search = page.getByRole('searchbox', { name: 'Add a creature' });
  await search.fill('goblin');
  await page
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /^Goblin\b/ })
    .first()
    .click();
  await search.fill('goblin boss');
  await page
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /Goblin Boss/ })
    .click();
  const rows = page.getByRole('region', { name: 'Rows' });
  const goblins = rows.getByRole('row', { name: 'Goblin', exact: true });
  await goblins.getByLabel('Weight of Goblin').fill('3');
  await goblins.getByLabel('How many of Goblin').fill('1d4+1');
  await goblins.getByLabel('How many of Goblin').press('Enter');
  // A d4: goblins on 1–3, their boss on 4.
  await expect(rows.getByRole('columnheader', { name: 'd4' })).toBeVisible();
  await expect(goblins).toContainText('1–3');
  await expect(rows.getByRole('row', { name: 'Goblin Boss' })).toContainText('4');
  // Bad dice are not kept.
  await goblins.getByLabel('How many of Goblin').fill('lots');
  await expect(goblins.getByLabel('How many of Goblin')).toHaveAttribute('aria-invalid', 'true');
  await goblins.getByLabel('How many of Goblin').fill('1d4+1');
  await goblins.getByLabel('How many of Goblin').press('Enter');

  // The region it belongs to.
  const links = page.getByRole('complementary', { name: 'Linked to' });
  await links.getByLabel('Link a note').fill('Cragmaw Woods');
  await links.getByRole('button', { name: 'Link the note' }).click();
  await expect(links.getByRole('link', { name: 'Cragmaw Woods' })).toBeVisible();

  // Rolled five times; the creatures that came up make an encounter.
  const roll = page.getByRole('complementary', { name: 'Roll' });
  await roll.getByLabel('Rolls of Woods encounters at once').fill('5');
  await roll.getByRole('button', { name: 'Roll Woods encounters' }).click();
  await expect(
    roll.getByRole('list', { name: 'Rolled on Woods encounters' }).getByRole('listitem'),
  ).toHaveCount(5);
  await roll.getByRole('button', { name: 'Build an encounter' }).click();
  await expect(page).toHaveURL(/#\/encounters\/[a-z0-9]+$/);
  await expect(page.getByRole('textbox', { name: 'Encounter name' })).toHaveValue(
    'Woods encounters',
  );
  await expect(
    page.getByRole('region', { name: 'Monsters' }).getByRole('listitem').first(),
  ).toBeVisible();

  // The region's note shows its table, ready to roll (the side panel is for wide screens).
  if (!isPhone(page) && (page.viewportSize()?.width ?? 0) >= 1024) {
    await page.goto(`./#/journal?note=${encodeURIComponent('Cragmaw Woods.md')}`);
    const side = page.getByRole('complementary', { name: 'Journal side' });
    const tables = side.getByRole('region', { name: 'Tables' });
    await expect(tables.getByRole('listitem', { name: 'Woods encounters' })).toBeVisible();
    await tables.getByRole('button', { name: 'Roll Woods encounters' }).click();
    await expect(
      tables.getByRole('list', { name: 'Rolled on Woods encounters' }).getByRole('listitem'),
    ).toHaveCount(1);
  }
});

test('a shop’s wares show on the encounter it is linked to, and loot rolls into it', async ({
  page,
}) => {
  await createCampaign(page, 'Rust and Sunfire');
  await newTable(page, 'Smithy', 'Shop');
  await page.getByLabel('Add a row of text').fill('Horseshoe');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const horseshoe = page
    .getByRole('region', { name: 'Rows' })
    .getByRole('row', { name: 'Horseshoe' });
  await horseshoe.getByLabel('Price of Horseshoe').fill('5 sp');
  await horseshoe.getByLabel('Price of Horseshoe').press('Enter');

  await newTable(page, 'Goblin pockets', 'Loot');
  await page.getByLabel('Add a row of text').fill('Copper pieces');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const copper = page
    .getByRole('region', { name: 'Rows' })
    .getByRole('row', { name: 'Copper pieces' });
  await copper.getByLabel('How many of Copper pieces').fill('2d6*10');
  await copper.getByLabel('How many of Copper pieces').press('Enter');
  await expect(copper.getByLabel('How many of Copper pieces')).toHaveValue('2d6*10');

  // An encounter links both from its own page.
  await page.goto('./#/encounters');
  await page.getByRole('button', { name: 'New encounter' }).click();
  await page.getByRole('form', { name: 'New encounter' }).getByLabel('Name').fill('Market brawl');
  await page
    .getByRole('form', { name: 'New encounter' })
    .getByRole('button', { name: 'Create' })
    .click();
  const tables = page.getByRole('region', { name: 'Tables' });
  await tables.getByLabel('Link a table').selectOption({ label: 'Smithy' });
  await tables.getByLabel('Link a table').selectOption({ label: 'Goblin pockets' });
  // The first table linked opens by itself.
  await expect(tables.getByRole('list', { name: 'Wares of Smithy' })).toContainText('Horseshoe');
  await expect(tables.getByRole('list', { name: 'Wares of Smithy' })).toContainText('5 sp');
  await tables.getByRole('button', { name: 'Open Goblin pockets' }).click();
  await tables.getByRole('button', { name: 'Roll Goblin pockets' }).click();
  await expect(tables.getByRole('list', { name: 'Rolled on Goblin pockets' })).toContainText(
    /\d+ × Copper pieces/,
  );

  // The table knows what it is linked to.
  await tables.getByRole('link', { name: 'Smithy' }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Linked to' })
      .getByRole('link', { name: 'Market brawl' }),
  ).toBeVisible();
});
