import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { installData, isPhone } from './helpers/journal';
import { waitForSaved } from './helpers/saved';

/** Whole buildings: drawn on the grid, floors stepped through, rooms kept, rolled and baked. */

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function newMap(page: Page, name: string) {
  await page.goto('./#/maps');
  await page.getByRole('button', { name: 'New map' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Map name' })).toHaveValue(name);
  await expect(page.getByRole('application', { name: 'Map canvas' }).locator('canvas')).toHaveCount(
    1,
  );
}

const tool = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name, exact: true });

const CORE = '!Core_Settlements/';
/** Real Forgotten Adventures names for a timber building. */
const BUILDING = [
  'Textures/Wooden_Floors/Wooden_Flooring_A_Ashen.jpg',
  'Textures/Stone_Floors/Large_Flagstone_A_04.jpg',
  'Structures/Building/Walls_and_Curbs/Wall_PlasterWood_A/Wall_PlasterWood_Ashen_A1_Straight_Path.png',
  'Structures/Building/Doors/Door_Wood_Dark_A_1x1.png',
  'Structures/Building/Windows/Small_Windows/Window_Small_Wood_Dark_A_1x1.png',
  'Structures/Building/Stairs_and_Ladders/Stairs_Wood/Stairs_Wood_Dark_A_1x3.png',
  'Furniture/Tables/Rectangle_Tables/Table_Rectangle_Wood_Red_F_2x1.png',
  'Furniture/Seating/Chairs/Chair_Wood_Dark_E_1x1.png',
].map((p) => CORE + p);

async function importPack(page: Page, names: string[]) {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'FA_Assets_Webp/Copyright.url': strToU8('[InternetShortcut]'),
  };
  for (const n of names) files[`FA_Assets_Webp/${n}`] = [PIXEL, { level: 0 }];
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'Mini_FA.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync(files)),
  });
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
}

test('a tavern is drawn as a whole building with a cellar and a floor above', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  test.setTimeout(120_000);
  await installData(page);
  await newMap(page, 'Harbour Street');
  await tool(page, 'Stamp').click();
  await importPack(page, BUILDING);
  await tool(page, 'Building').click();
  await page
    .getByRole('radiogroup', { name: 'What to draw' })
    .getByRole('radio', { name: /Whole building/ })
    .click();
  await page
    .getByRole('radiogroup', { name: 'Kind of building' })
    .getByRole('radio', { name: /Tavern/ })
    .click();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + 120, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 480, box.y + 380, { steps: 8 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"kind":"structure"');
  await waitForSaved(page, 'maps', '"archetype":"tavern"');
  // The common room's furniture is picked from the packs with the building.
  await waitForSaved(page, 'maps', 'Table_Rectangle_Wood_Red_F_2x1');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('ground-floor.png') });

  // A variant per floor: Page Down goes up to the first floor.
  const settings = page.getByRole('textbox', { name: 'Building name' });
  await expect(settings).toHaveValue('Tavern or inn');
  await canvas.click({ position: { x: 700, y: 520 } });
  await page.keyboard.press('PageDown');
  await waitForSaved(page, 'maps', '"activeVariant"');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('first-floor.png') });
  await page.keyboard.press('PageUp');

  // Pick it again, keep a room, roll again, then bake it into rooms and stamps.
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 300, box.y + 240);
  await expect(page.getByRole('textbox', { name: 'Building name' })).toBeVisible();
  const rooms = page.getByRole('group', { name: 'Rooms' });
  await rooms.getByRole('button', { name: /Common room/ }).click();
  await rooms.getByRole('button', { name: 'Keep it' }).click();
  await waitForSaved(page, 'maps', '"rooms":[');
  await page.getByRole('button', { name: 'Roll again' }).click();
  await waitForSaved(page, 'maps', '"stairSeed"');
  await page.getByRole('button', { name: 'Cut corners' }).click();
  await waitForSaved(page, 'maps', '"chamfers"');
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('worn');
  await waitForSaved(page, 'maps', '"condition":"worn"');
  await page.getByRole('button', { name: 'Bake', exact: true }).click();
  await waitForSaved(page, 'maps', '"kind":"room"');
  await waitForSaved(page, 'maps', 'Door_Wood_Dark_A_1x1');
  // The furniture is baked into stamps (the building and its spec are gone).
  await waitForSaved(page, 'maps', 'Chair_Wood_Dark_E_1x1');
});
