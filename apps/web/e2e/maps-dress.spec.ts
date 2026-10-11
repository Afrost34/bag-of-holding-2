import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { installData, isPhone } from './helpers/journal';
import { waitForSaved } from './helpers/saved';

/** Dressing a map from the packs: variations of picked stamps (more tools join here). */

/** A 1×1 PNG. */
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

/** A pack with real Forgotten Adventures names, each a one-pixel picture. */
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

const WARDROBES = '!Core_Settlements/Furniture/Cupboards_and_Wardrobes/Wardrobes/';

test('picked stamps get another shape, colour or material', async ({ page }) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  await installData(page);
  await newMap(page, 'Bedroom');
  await tool(page, 'Stamp').click();
  await importPack(
    page,
    ['Ashen_A1', 'Ashen_A2', 'Dark_A1'].map((n) => `${WARDROBES}Wardrobe_Wood_${n}_2x1.png`),
  );
  await page.getByLabel('Find a pack picture').fill('wardrobe');
  await page
    .getByRole('list', { name: 'Pack pictures' })
    .getByRole('button', { name: 'Wardrobe Wood Ashen A1' })
    .click();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + 300, box.y + 300);
  await waitForSaved(page, 'maps', 'Wardrobe_Wood_Ashen_A1_2x1');
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 300, box.y + 300);

  // Swap material: the wardrobe comes in dark wood too.
  const variations = page.getByRole('group', { name: 'Variations' });
  await variations
    .getByRole('group', { name: 'Swap material' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await waitForSaved(page, 'maps', 'Wardrobe_Wood_Dark_A1_2x1');

  // Randomize with only the shape: dark wood has one shape, so it stays dark wood.
  await variations.getByLabel('Turn and mirror').uncheck();
  await variations.getByRole('button', { name: 'Randomize' }).click();
  await waitForSaved(page, 'maps', 'Wardrobe_Wood_Dark_A1_2x1');
});

const FLORA = 'Woodlands/!Wilderness/Flora/';

test('a forest recipe lays trees, then undergrowth at its edge, from the pack', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  await installData(page);
  await newMap(page, 'Greenwood');
  await tool(page, 'Stamp').click();
  await importPack(page, [
    ...['Green_A1_6x6', 'Multicolor1_C2_5x5', 'Red_D5_5x5'].map(
      (n) => `${FLORA}Trees/Tree_${n}.png`,
    ),
    ...['Green_A1_1x1', 'Green_F6_2x2', 'Multicolor1_F5_2x2'].map(
      (n) => `${FLORA}Bushes/Bush_${n}.png`,
    ),
    `${FLORA}Plants/Ferns/Fern_Green_A1_2x2.png`,
  ]);
  await tool(page, 'Dress').click();
  // With a pack, the tool opens on the pack's forest.
  await expect(
    page.getByRole('radiogroup', { name: 'Nature recipes' }).getByRole('radio', { name: /Forest/ }),
  ).toHaveAttribute('aria-checked', 'true');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  for (const [x, y] of [
    [120, 120],
    [620, 130],
    [600, 480],
    [130, 460],
  ] as const)
    await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"recipe":"forest"');
  await waitForSaved(page, 'maps', '"place":"edge"');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('forest.png') });
  // The dressing just made is picked: other pictures of the same kinds, then another roll.
  await page.getByRole('button', { name: 'Pick again' }).click();
  await page.getByRole('button', { name: 'Roll again' }).click();
  await waitForSaved(page, 'maps', '"from":"forest:canopy"');
});

test('tracks follow a trail, pointing the way it goes', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  await installData(page);
  await newMap(page, 'Wolf Trail');
  await tool(page, 'Stamp').click();
  await importPack(page, [
    'Woodlands/!Wilderness/Decor/Tracks/Tracks_Dirt_02_Wolf_A2_1x1.png',
    'Woodlands/!Wilderness/Decor/Tracks/Tracks_Dirt_03_Wolf_A2_1x1.png',
  ]);
  await tool(page, 'Dress').click();
  await page
    .getByRole('radiogroup', { name: 'Edges recipes' })
    .getByRole('radio', { name: /^Tracks/ })
    .click();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  for (const [x, y] of [
    [120, 300],
    [400, 260],
    [680, 320],
  ] as const)
    await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"recipe":"tracks"');
  await waitForSaved(page, 'maps', '"turn":90');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('tracks.png') });
});

const CORE = '!Core_Settlements/';
/** Real furniture names: a common room's tables, seats, tableware and storage. */
const FURNITURE = [
  'Furniture/Tables/Rectangle_Tables/Table_Rectangle_Wood_Red_F_2x1.png',
  'Furniture/Seating/Chairs/Chair_Wood_Dark_E_1x1.png',
  'Furniture/Seating/Stools/Stool_Fabric_Green_Wood_Dark_B1_1x1.png',
  'Furniture/Seating/Benches/Bench_Wood_Ashen_D1_2x1.png',
  'Clutter/Food/Prepared_Meals/Dishes/Plates/Plate_Metal_Gray_Filled_B1_1x1.png',
  'Lightsources/Candles/Arranged_Candles/Candles_Yellow_Arranged_A1_1x1.png',
  'Decor/Storage/Barrels/Filled/Barrel_Wood_Walnut_Water_Clear_B1_1x1.png',
  'Decor/Storage/Boxes_and_Crates/Crates/Crate_Wood_Light_A_1x1.png',
].map((p) => CORE + p);

test('a room is furnished from the pack: tables down the middle, seats round them, a setting at each', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  test.setTimeout(90_000);
  await installData(page);
  await newMap(page, 'Gull and Anchor');
  await tool(page, 'Stamp').click();
  await importPack(page, FURNITURE);
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Room').click();
  await page.mouse.move(box.x + 80, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 560, box.y + 420, { steps: 8 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"kind":"room"');
  await page.getByRole('button', { name: 'Common room' }).click();
  await waitForSaved(page, 'maps', '"recipe":"tavern"');
  await waitForSaved(page, 'maps', '"place":"around"');
  await waitForSaved(page, 'maps', '"place":"setting"');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('common-room.png') });

  // A table put down by hand gets something in the middle.
  await tool(page, 'Stamp').click();
  await page.getByLabel('Find a pack picture').fill('table rectangle');
  await page
    .getByRole('list', { name: 'Pack pictures' })
    .getByRole('button', { name: 'Table Rectangle Wood Red F' })
    .click();
  await page.mouse.click(box.x + 700, box.y + 500);
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 700, box.y + 500);
  await page.getByRole('button', { name: 'Dress this table' }).click();
  await waitForSaved(page, 'maps', 'Candles_Yellow_Arranged_A1_1x1');
});

test('lit braziers and wall lamps light the map by themselves', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  test.setTimeout(90_000);
  await installData(page);
  await newMap(page, 'Throne Room');
  await tool(page, 'Stamp').click();
  await importPack(page, [
    `${CORE}Lightsources/Braziers/Lit/Brazier_Metal_Gray_E1_Lit_2x2.png`,
    `${CORE}Lightsources/Interior_Wall_Lights/Wall_Light_Metal_Bronze_F1_1x1.png`,
    `${CORE}Lightsources/Interior_Wall_Lights/Wall_Light_Black_Metal_Rusty_A1_1x1.png`,
  ]);
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  // Night falls, so the lights show.
  await tool(page, 'Light').click();
  await page.getByLabel('Ambient preset').selectOption({ label: 'Night' });
  await tool(page, 'Stamp').click();
  await page.getByLabel('Find a pack picture').fill('brazier');
  await page
    .getByRole('list', { name: 'Pack pictures' })
    .getByRole('button', { name: 'Brazier Metal Gray E1 Lit' })
    .click();
  await page.mouse.click(box.x + 650, box.y + 450);
  await waitForSaved(page, 'maps', 'Brazier_Metal_Gray_E1_Lit_2x2');
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 650, box.y + 450);
  const light = page.getByRole('group', { name: 'Light' });
  await expect(light.getByLabel(/Gives light/)).toBeChecked();
  await light.getByLabel('Light reach').fill('9');
  await waitForSaved(page, 'maps', '"squares":9');
  // A room lit by lamps on its walls.
  await tool(page, 'Room').click();
  await page.mouse.move(box.x + 80, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 380, { steps: 8 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"kind":"room"');
  await page.getByRole('button', { name: 'Light this room' }).click();
  await waitForSaved(page, 'maps', '"recipe":"room-lights"');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('lit-room.png') });
});
