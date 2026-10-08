import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installData } from './helpers/journal';

/** Homebrew: make an item in a pack, find it everywhere, carry the pack to another install. */

/** A 1×1 PNG. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => {
  await installData(page);
});

async function makeItem(page: Page) {
  await page.goto('./#/homebrew');
  await page.getByRole('button', { name: 'New pack' }).click();
  await page.getByRole('form', { name: 'New pack' }).getByLabel('Name').fill('Rust & Sunfire');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rust & Sunfire' })).toBeVisible();

  await page.getByRole('button', { name: 'New item' }).click();
  const form = page.getByRole('form', { name: 'Item' });
  await form.getByLabel('Name', { exact: true }).fill('Sunblade');
  await form.getByLabel('Kind').selectOption('weapon-melee');
  await form.getByLabel('Rarity').selectOption('rare');
  await form.getByLabel('Damage', { exact: true }).fill('1d8');
  await form.getByLabel('Bonus to attacks and damage').selectOption('2');
  await form.getByLabel('What it is and what it does').fill('Deals an extra 2d6 radiant damage.');
  // A picture from the device (shrunk and kept in the pack).
  await form.getByLabel('Picture file').setInputFiles({
    name: 'sunblade.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG, 'base64'),
  });
  await expect(form.locator('img[src^="data:image/"]')).toBeVisible();
  // The preview follows the form.
  const preview = page.getByRole('complementary', { name: 'Preview' });
  await expect(preview).toContainText('Sunblade');
  await expect(preview).toContainText('+2 bonus to attack and damage rolls');
  await expect(preview.getByRole('button', { name: '2d6' })).toBeVisible();
  await form.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByRole('status')).toContainText('Saved “Sunblade”');
}

test('an item made in a pack shows in the compendium and in search', async ({ page }) => {
  await makeItem(page);
  await page.getByRole('link', { name: 'Sunblade' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sunblade' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Homebrew', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').locator('img[src^="data:image/"]')).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.getByLabel('Search everything').fill('sunbla');
  await expect(page.getByRole('option', { name: /Sunblade/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // Editing keeps it and changes it everywhere.
  await page.goto('./#/homebrew');
  await page.getByRole('link', { name: /Rust & Sunfire/ }).click();
  await page.getByRole('button', { name: 'Edit Sunblade' }).click();
  await page.getByRole('form', { name: 'Item' }).getByLabel('Rarity').selectOption('legendary');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('link', { name: 'Sunblade' }).click();
  await expect(page.getByText('Melee weapon, legendary')).toBeVisible();
});

test('a pack exported on one install imports on another', async ({ page, browser }) => {
  await makeItem(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = await (await download).path();
  const json = readFileSync(file, 'utf8');

  // A second install: a fresh browser profile.
  const other = await browser.newPage();
  await installData(other);
  await other.goto('./#/homebrew');
  await other.getByLabel('Pack file').setInputFiles({
    name: 'rust-sunfire.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect(other.getByRole('status')).toContainText('Imported');
  await other.goto('./#/compendium/list/magic-items');
  await other.keyboard.press('Control+k');
  await other.getByLabel('Search everything').fill('sunblade');
  await other.getByRole('option', { name: /Sunblade/ }).click();
  await expect(other.getByRole('heading', { level: 1, name: 'Sunblade' })).toBeVisible();
  await other.close();
});

test('a monster is made with its numbers worked out', async ({ page }) => {
  await page.goto('./#/homebrew');
  await page.getByRole('button', { name: 'New pack' }).click();
  await page.getByRole('form', { name: 'New pack' }).getByLabel('Name').fill('Monsters');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.getByRole('button', { name: 'New monster' }).click();
  const form = page.getByRole('form', { name: 'Monster' });
  await form.getByLabel('Name', { exact: true }).fill('Rust Goblin');
  await form.getByLabel('DEX', { exact: true }).fill('14');
  await form.getByRole('button', { name: 'Dexterity saving throw' }).click();
  await form.getByRole('button', { name: 'Stealth: not proficient' }).click();
  await form.getByRole('button', { name: 'Add an action' }).click();
  await form.getByLabel('Action 1', { exact: true }).fill('Scimitar');
  await form.getByRole('button', { name: 'Build an attack for action 1' }).click();
  await form.getByLabel('Using').selectOption('dex');
  await form.getByRole('button', { name: 'Use this attack' }).click();
  await expect(form.getByLabel('What action 1 does')).toHaveValue(
    'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage.',
  );
  const preview = page.getByRole('complementary', { name: 'Preview' });
  await expect(preview).toContainText('Stealth +4');
  await expect(preview.getByRole('button', { name: '1d6 + 2' })).toBeVisible();
  await form.getByRole('button', { name: 'Save monster' }).click();
  await page.getByRole('link', { name: 'Rust Goblin' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rust Goblin' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Melee Attack Roll');
});

test('a spell is made and shows like the book ones', async ({ page }) => {
  await page.goto('./#/homebrew');
  await page.getByRole('button', { name: 'New pack' }).click();
  await page.getByRole('form', { name: 'New pack' }).getByLabel('Name').fill('Spells');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.getByRole('button', { name: 'New spell' }).click();
  const form = page.getByRole('form', { name: 'Spell' });
  await form.getByLabel('Name', { exact: true }).fill('Rust Burst');
  await form.getByLabel('Level', { exact: true }).selectOption('3');
  await form.getByLabel('Range', { exact: true }).selectOption('area');
  await form.getByLabel('Feet').fill('15');
  await form.getByLabel('Area', { exact: true }).selectOption('cone');
  await form.getByRole('button', { name: 'Wizard' }).click();
  await form
    .getByLabel('What the spell does')
    .fill(
      'Each creature in the cone makes a Dexterity saving throw (DC 15) or takes 6d6 fire damage.',
    );
  const preview = page.getByRole('complementary', { name: 'Preview' });
  await expect(preview).toContainText('Self (15-foot cone)');
  await expect(preview.getByRole('button', { name: '6d6' })).toBeVisible();
  await form.getByRole('button', { name: 'Save spell' }).click();
  await page.getByRole('link', { name: 'Rust Burst' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rust Burst' })).toBeVisible();
});

test('a pack is a source with a cover, and holds feats, species and classes', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./#/homebrew');
  await page.getByRole('button', { name: 'New pack' }).click();
  await page.getByRole('form', { name: 'New pack' }).getByLabel('Name').fill('Corsairs');
  await page.getByRole('button', { name: 'Create pack' }).click();

  // A cover, like a book's.
  await page.getByLabel('Cover file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG, 'base64'),
  });
  await expect(page.getByRole('img', { name: 'Cover' })).toHaveAttribute('src', /^data:image\//);

  // A feat.
  await page.getByRole('button', { name: 'New feat' }).click();
  const feat = page.getByRole('form', { name: 'Feat' });
  await feat.getByLabel('Name', { exact: true }).fill('Sea Legs');
  await feat.getByLabel('Benefits').fill('You never fall on a moving deck.');
  await expect(page.getByRole('complementary', { name: 'Preview' })).toContainText(
    'You never fall on a moving deck.',
  );
  await feat.getByRole('button', { name: 'Save feat' }).click();
  await expect(page.getByRole('status')).toContainText('Saved “Sea Legs”');

  // Species with a trait.
  await page.getByRole('button', { name: 'New species' }).click();
  const species = page.getByRole('form', { name: 'Species' });
  await species.getByLabel('Name', { exact: true }).fill('Tidekin');
  await species.getByRole('button', { name: 'Add a trait' }).click();
  await species.getByLabel('Trait 1', { exact: true }).fill('Amphibious');
  await species.getByLabel('What trait 1 does').fill('You can breathe air and water.');
  await species.getByRole('button', { name: 'Save species' }).click();

  // A class with a feature.
  await page.getByRole('button', { name: 'New class' }).click();
  const cls = page.getByRole('form', { name: 'Class' });
  await cls.getByLabel('Name', { exact: true }).fill('Corsair');
  await cls.getByRole('button', { name: 'Dexterity' }).first().click();
  await cls.getByRole('button', { name: 'Add a feature' }).click();
  await cls.getByLabel('Feature 1', { exact: true }).fill('Sea Dog');
  await cls.getByLabel('What feature 1 does').fill('You know ships.');
  await expect(page.getByRole('complementary', { name: 'Preview' })).toContainText('Sea Dog');
  await cls.getByRole('button', { name: 'Save class' }).click();

  // The pack lists them like the compendium: open a row to read it.
  for (const name of ['Feats', 'Species', 'Classes']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Show Tidekin' }).click();
  await expect(page.getByRole('main')).toContainText('You can breathe air and water.');
  await page.getByRole('button', { name: 'Show Corsair' }).click();
  await expect(page.getByRole('main')).toContainText('You know ships.');

  // They are in the compendium like the book ones.
  await page.getByRole('link', { name: 'Sea Legs' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sea Legs' })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Corsair', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Corsair' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Sea Dog');

  // The homebrew list shows the cover.
  await page.goto('./#/homebrew');
  await expect(
    page.getByRole('list', { name: 'Packs' }).locator('img[src^="data:image/"]'),
  ).toBeVisible();
});
