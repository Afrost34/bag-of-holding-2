import { expect, test, type Page } from '@playwright/test';
import { createCampaign, installData } from './helpers/journal';
import { waitForSaved } from './helpers/saved';

/** Characters: build one step by step; every choice the rules ask for is tracked and kept. */

/** A 1×1 PNG. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => {
  await installData(page);
});

async function newCharacter(page: Page, name: string, edition: '2014 rules' | '2024 rules') {
  await page.goto('./#/characters');
  await page.getByRole('button', { name: 'New character' }).click();
  const form = page.getByRole('form', { name: 'New character' });
  await form.getByLabel('Name').fill(name);
  await form.getByRole('radio', { name: edition }).check();
  await form.getByRole('button', { name: 'Start building' }).click();
}

/** Picks a class from the list and confirms it in the dialog. */
async function addClass(page: Page, name: RegExp) {
  await page.getByRole('list', { name: 'classes' }).getByRole('button', { name }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add class' }).click();
}

const step = (page: Page, name: RegExp) =>
  page.getByRole('navigation', { name: 'Builder steps' }).getByRole('link', { name });

test('a character is built from its choices and kept', async ({ page }) => {
  await newCharacter(page, 'Lia', '2014 rules');

  // Class: picked from the list, confirmed, then its choices sit in its features.
  await page.getByRole('searchbox', { name: 'Search classes' }).fill('bard');
  await addClass(page, /Bard/);
  const core = page.getByRole('region', { name: 'Core Bard Traits' });
  await core.getByLabel('Choose 3 skills (1)').selectOption('arcana');
  await core.getByLabel('Choose 3 skills (2)').selectOption('history');
  await core.getByLabel('Choose 3 skills (3)').selectOption('stealth');
  // A skill picked in one list is not offered in the others.
  await expect(
    core.getByLabel('Choose 3 skills (1)').locator('option[value="history"]'),
  ).toHaveCount(0);

  // Level 3: the subclass is picked in the feature that grants it.
  await page.getByLabel('Level', { exact: true }).selectOption('3');
  await page
    .getByRole('region', { name: 'Bard College' })
    .getByLabel('Choose your subclass')
    .selectOption({ label: 'College of Lore' });
  await expect(page.getByRole('heading', { name: 'Bard' }).locator('..')).toContainText(
    'College of Lore',
  );

  // Species, with its subspecies.
  await step(page, /Species/).click();
  await page.getByRole('list', { name: 'species' }).getByRole('button', { name: /Elf/ }).click();
  await page
    .getByRole('region', { name: 'Subspecies' })
    .getByLabel('Choose a subspecies')
    .selectOption({ label: 'High' });

  // Abilities: the standard array plus the species' increases.
  await step(page, /Abilities/).click();
  const dex = page.getByRole('region', { name: 'Dexterity calculation' });
  await expect(dex).toContainText('Total Score16');
  await expect(dex).toContainText('Bonus+2');
  await page.getByLabel('Strength base score').selectOption('8');
  await page.getByLabel('Charisma base score').selectOption('15');
  await expect(page.getByRole('status')).toHaveCount(0);

  // The sheet: numbers from the rules, with their parts, and a value set by hand.
  await step(page, /Sheet/).click();
  await page.getByRole('button', { name: 'Details: Armor Class' }).click();
  const details = page.getByRole('region', { name: 'Armor Class details' });
  await expect(details).toContainText('Dexterity');
  await expect(details).toContainText('13');
  await details.getByRole('spinbutton').fill('15');
  await details.getByRole('button', { name: 'Set' }).click();
  await page.getByRole('button', { name: 'Details: Armor Class' }).click();
  await expect(details).toContainText('By the rules');
  await details.getByRole('button', { name: /Use the rules value/ }).click();

  // Everything is kept: after a reload the choices are still there.
  await page.reload();
  await step(page, /Class/).click();
  // Finished sections start folded.
  await page.getByRole('button', { name: /Core Bard Traits/ }).click();
  await expect(
    page.getByRole('region', { name: 'Core Bard Traits' }).getByLabel('Choose 3 skills (1)'),
  ).toHaveValue('arcana');
  await page.getByRole('link', { name: 'Characters', exact: true }).first().click();
  await expect(page.getByRole('link', { name: /Lia/ })).toContainText('Level 3 Elf Bard');
});

test('a multiclass character in a campaign, with rolled hit points, copied to the library', async ({
  page,
}) => {
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/characters');
  await page.getByRole('button', { name: 'New character' }).click();
  const form = page.getByRole('form', { name: 'New character' });
  await form.getByLabel('Name').fill('Brakka');
  await expect(form.getByLabel('Keep in')).toHaveValue('rust-and-sunfire');
  await form.getByRole('radio', { name: '2014 rules' }).check();
  await form.getByRole('button', { name: 'Start building' }).click();
  await expect(page.getByRole('main').getByText('· Rust and Sunfire')).toBeVisible();

  // Fighter 2.
  await addClass(page, /Fighter/);
  await page.getByLabel('Level', { exact: true }).selectOption('2');

  // The standard array leaves Charisma at 8: Bard's requirement is enforced by default…
  await page.getByRole('button', { name: 'Add another class' }).click();
  await expect(
    page.getByRole('list', { name: 'classes' }).getByRole('button', { name: /Bard/ }),
  ).toBeDisabled();
  await expect(page.getByRole('list', { name: 'classes' })).toContainText('Charisma 13');
  // …and can be turned off in the character's preferences, leaving a warning.
  await step(page, /Home/).click();
  await page.getByRole('checkbox', { name: 'Multiclass requirements' }).uncheck();
  await step(page, /Class/).click();
  await page.getByRole('button', { name: 'Add another class' }).click();
  await addClass(page, /Bard/);
  await expect(page.getByText('Level 3 Fighter 2 / Bard 1')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Warnings' })).toContainText(
    'Multiclassing with Bard needs Charisma 13.',
  );

  // Hit points: 10 + average 6 for Fighter 2 + average 5 for Bard 1 + Constitution +1 × 3.
  await page.getByRole('button', { name: 'Manage HP' }).click();
  const hp = page.getByRole('region', { name: 'Hit points' });
  await expect(hp).toContainText('Hit points: 24');
  await hp.getByRole('radio', { name: 'Rolled' }).click();
  await hp.getByLabel('Hit point roll for Fighter 2').fill('10');
  await expect(hp).toContainText('Hit points: 28');

  // Copied to the library: same choices, the campaign's copy untouched.
  await page.getByRole('link', { name: 'Characters', exact: true }).first().click();
  await page.getByLabel('Copy Brakka to').selectOption('Library');
  await expect(page.getByRole('region', { name: 'Library' })).toContainText(
    'Level 3 Fighter 2 / Bard 1',
  );
  await expect(page.getByRole('region', { name: 'Rust and Sunfire' })).toContainText('Brakka');
});

test('a companion is a stat block attached to the character', async ({ page }) => {
  await newCharacter(page, 'Wren', '2024 rules');
  // A portrait from the device, kept small in the character file.
  await page.getByRole('button', { name: 'Change portrait' }).click();
  await page
    .getByRole('dialog', { name: 'Portrait' })
    .getByLabel('Portrait file')
    .setInputFiles({
      name: 'wren.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG, 'base64'),
    });
  await expect(page.getByRole('img', { name: 'Portrait of Wren' })).toBeVisible();
  await step(page, /Sheet/).click();
  await page.getByRole('searchbox', { name: 'Add a creature' }).fill('gobl');
  await page.getByRole('list', { name: 'Creatures found' }).getByRole('button').first().click();
  await page.getByLabel('Name for Goblin').fill('Snik');
  const snik = page.getByRole('region', { name: 'Snik' });
  await expect(snik).toContainText('Scimitar');
  await snik.getByLabel('What Snik is').selectOption('familiar');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Snik' }).getByLabel('What Snik is')).toHaveValue(
    'familiar',
  );
});

test('the character sheet prints on A4 pages', async ({ page }, testInfo) => {
  // A PDF and a picture of every page: more than the default 30 s on a busy machine.
  test.setTimeout(60_000);
  await newCharacter(page, 'Lia', '2014 rules');
  await addClass(page, /Bard/);
  await page.getByLabel('Level', { exact: true }).selectOption('3');
  await step(page, /Sheet/).click();
  await page.getByRole('link', { name: /Printable sheet/ }).click();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
  const preview = page.locator('main .paper');
  await expect(preview.getByText('Attacks & cantrips')).toBeVisible();
  await expect(preview.getByText('Bard 3')).toBeVisible();
  // Pages can be left out, and stay left out.
  await page.getByRole('button', { name: 'Pages' }).click();
  await page.getByRole('checkbox', { name: 'Personality and backstory' }).uncheck();
  await expect(preview.getByText('Backstory', { exact: true })).toHaveCount(0);
  // Reload once the choice is on disk (the write is quick, but a reload at once can beat it).
  await waitForSaved(page, 'characters', '"story"');
  await page.reload();
  await page.getByRole('button', { name: 'Pages' }).click();
  await expect(page.getByRole('checkbox', { name: 'Personality and backstory' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Personality and backstory' }).check();
  await expect(preview.getByText('Backstory', { exact: true })).toBeVisible();
  // Every page, cards included, is exactly A4 (297 mm = 1122.5 CSS px), however much is on it.
  const heights = await preview
    .locator('.sheet-page')
    .evaluateAll((pages) => pages.map((p) => p.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(4);
  for (const h of heights) expect(Math.abs(h - (297 * 96) / 25.4)).toBeLessThan(1);
  // Printing shows only the sheet: one copy, page by page.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-root .sheet-page').first()).toBeVisible();
  await expect(page.locator('main')).toBeHidden();
  if (testInfo.project.name === 'desktop') {
    await page.pdf({ path: testInfo.outputPath('sheet.pdf'), format: 'A4', printBackground: true });
    const pages = page.locator('.print-root .sheet-page');
    for (let i = 0; i < (await pages.count()); i++)
      await pages.nth(i).screenshot({ path: testInfo.outputPath(`page-${String(i + 1)}.png`) });
  }
});
