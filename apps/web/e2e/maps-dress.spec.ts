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
  await waitForSaved(page, 'maps', '"from":"forest:trees"');
});
