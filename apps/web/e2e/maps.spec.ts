import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { createCampaign, installData, isPhone, newNote } from './helpers/journal';
import { waitForSaved } from './helpers/saved';

/** Maps: a canvas with a grid, stamps from the library, brushes, walls, text, templates, pins. */

/** A 2×2 red PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8DwnwEJMJIuAAC2BgL+0n0vRgAAAABJRU5ErkJggg==',
  'base64',
);

/** Width and height from a PNG's header. */
const pngSize = (bytes: Buffer) => ({
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
});

async function newMap(page: Page, name: string) {
  await page.goto('./#/maps');
  await page.getByRole('button', { name: 'New map' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Map name' })).toHaveValue(name);
  // The canvas is ready when Pixi has added its <canvas>.
  await expect(page.getByRole('application', { name: 'Map canvas' }).locator('canvas')).toHaveCount(
    1,
  );
}

/** The Creator draws the map, the Viewer uses it: this goes from one to the other. */
async function switchMode(page: Page, to: 'View map' | 'Edit map') {
  await page.getByRole('link', { name: to }).click();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  await expect(canvas.locator('canvas')).toHaveCount(1);
  // The page is laid out before anything measures it.
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(200);
}

const tool = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name, exact: true });

test('a map is drawn with stamps, brushes, walls, text, templates and pins, then exported', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'Drawing is checked on the desktop; phones get the same tools.');
  test.setTimeout(90_000);
  await newMap(page, 'Cragmaw Hideout');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y });

  // The stamp library: a folder whose sub-folders become categories.
  const folder = testInfo.outputPath('Dungeon');
  mkdirSync(join(folder, 'Doors'), { recursive: true });
  writeFileSync(join(folder, 'Doors', 'oak-door.png'), PNG);
  writeFileSync(join(folder, 'barrel.png'), PNG);
  await page.getByRole('tab', { name: 'My stamps' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import a folder' }).click(),
  ]);
  await chooser.setFiles(folder);
  await expect(page.getByRole('status').filter({ hasText: '2 stamps added.' })).toBeVisible();
  await page.getByLabel('Stamp category').selectOption('Dungeon/Doors');
  const pictures = page.getByRole('list', { name: 'Stamp pictures' });
  await expect(pictures.getByRole('listitem')).toHaveCount(1);
  await pictures.getByRole('button', { name: 'oak door' }).click();
  await expect(tool(page, 'Stamp')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(at(200, 200).x, at(200, 200).y);
  await expect(page.getByRole('region', { name: 'Stamp' })).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.getByLabel('Rotation')).toHaveValue('15');

  // A brush stroke, a wall, a text, a cone and a pin.
  await tool(page, 'Brush').click();
  await page.mouse.move(at(100, 300).x, at(100, 300).y);
  await page.mouse.down();
  await page.mouse.move(at(300, 350).x, at(300, 350).y, { steps: 10 });
  await page.mouse.up();
  await tool(page, 'Wall').click();
  for (const [x, y] of [
    [100, 100],
    [400, 100],
    [400, 250],
  ] as const)
    await page.mouse.click(at(x, y).x, at(x, y).y);
  await page.keyboard.press('Enter');
  await tool(page, 'Text').click();
  await page.mouse.click(at(300, 420).x, at(300, 420).y);
  await page.getByRole('region', { name: 'Text' }).getByLabel('Text').fill('Goblin lookout');
  await switchMode(page, 'View map');
  await tool(page, 'Spell template').click();
  await page.mouse.move(at(450, 300).x, at(450, 300).y);
  await page.mouse.down();
  await page.mouse.move(at(550, 300).x, at(550, 300).y, { steps: 5 });
  await page.mouse.up();
  // A range to measure: shown while it is dragged, never kept on the map.
  await expect(page.getByRole('region', { name: 'Template to draw' })).toBeVisible();
  await tool(page, 'Pin').click();
  await page.mouse.click(at(500, 150).x, at(500, 150).y);
  await page.getByLabel('Pin label').fill('Cave mouth');

  // Measuring counts squares (5 ft each), along a path: a point per click.
  await tool(page, 'Measure').click();
  await page.mouse.click(at(100, 500).x, at(100, 500).y);
  await page.mouse.click(at(400, 500).x, at(400, 500).y);
  const leg = page.getByRole('status').filter({ hasText: /Distance: \d+ ft/ });
  await expect(leg).toBeVisible();
  const feet = async () => Number(/(\d+) ft/.exec((await leg.textContent()) ?? '')?.[1]);
  const first = await feet();
  await page.mouse.click(at(400, 300).x, at(400, 300).y);
  await expect.poll(feet).toBeGreaterThan(first);
  await page.keyboard.press('Escape');
  await expect(leg).toHaveCount(0);

  // Everything is on the layers; undo takes the last one back.
  await page.getByRole('tab', { name: 'Layers' }).click();
  const countOf = async () => {
    const counts = await page
      .getByRole('region', { name: 'Layers' })
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.map((li) => Number(li.querySelector('span')?.textContent ?? 0)),
      );
    return counts.reduce((a, b) => a + b, 0);
  };
  await expect.poll(countOf).toBe(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(countOf).toBe(5); // the pin's label change is undone first
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(countOf).toBe(4);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(countOf).toBe(5);

  // Hex grid, then back.
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.getByLabel('Type').selectOption('hex');
  await page.getByLabel('Type').selectOption('square');

  // The PNG is the whole map at full size.
  // The export shows a preview, and asks for the picture's size and the pins'.
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export as a picture' });
  await expect(
    exportDialog.getByRole('img', { name: 'Preview of the exported map' }),
  ).toBeVisible();
  await exportDialog.getByLabel('Pin size').selectOption('3');
  await exportDialog.getByLabel('Export size').selectOption('0.5');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportDialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Cragmaw Hideout.png');
  const file = testInfo.outputPath('map.png');
  await download.saveAs(file);
  expect(pngSize(readFileSync(file))).toEqual({ width: 1400, height: 1050 });

  // Kept after a reload.
  await page.reload();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(countOf).toBe(5);
});

test('an 8k map with 1,000 stamps edits smoothly and exports as PNG', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Measured once, on the desktop.');
  test.setTimeout(180_000);
  await page.goto('./#/maps');
  // An 8192 × 8192 background and 1,000 stamps, written straight to storage.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = async (path: string[]) => {
      let d = await root.getDirectoryHandle('user-data', { create: true });
      for (const p of path) d = await d.getDirectoryHandle(p, { create: true });
      return d;
    };
    const write = async (path: string[], name: string, data: Blob | string) => {
      const f = await (await dir(path)).getFileHandle(name, { create: true });
      const w = await f.createWritable();
      await w.write(data);
      await w.close();
    };
    const picture = async (size: number, draw: (c: OffscreenCanvasRenderingContext2D) => void) => {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d');
      draw(ctx);
      return canvas.convertToBlob({ type: 'image/png' });
    };
    await write(
      ['maps', 'assets'],
      'world.png',
      await picture(8192, (c) => {
        const g = c.createLinearGradient(0, 0, 8192, 8192);
        g.addColorStop(0, '#5b7a3a');
        g.addColorStop(1, '#2f4f6f');
        c.fillStyle = g;
        c.fillRect(0, 0, 8192, 8192);
      }),
    );
    await write(
      ['stamps', 'Trees'],
      'tree.png',
      await picture(64, (c) => {
        c.fillStyle = '#14532d';
        c.beginPath();
        c.arc(32, 32, 30, 0, Math.PI * 2);
        c.fill();
      }),
    );
    const items = Array.from({ length: 1000 }, (_, i) => ({
      kind: 'stamp',
      id: `s${String(i)}`,
      stamp: 'Trees/tree.png',
      x: 100 + (i % 40) * 200,
      y: 100 + Math.floor(i / 40) * 320,
      w: 140,
      h: 140,
      rotation: (i * 37) % 360,
    }));
    await write(
      ['maps'],
      'world.json',
      JSON.stringify({
        version: 1,
        name: 'The Sword Coast',
        background: { path: 'maps/assets/world.png', width: 8192, height: 8192 },
        width: 8192,
        height: 8192,
        grid: { type: 'hex', size: 120, offsetX: 0, offsetY: 0, feet: 5, opacity: 0.25 },
        layers: [
          { id: 'l1', name: 'Ground', visible: true, locked: false, items },
          { id: 'l2', name: 'Notes', visible: true, locked: false, items: [] },
        ],
      }),
    );
  });
  await page.goto('./#/maps/world');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Map name' })).toHaveValue('The Sword Coast');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  await expect(canvas.locator('canvas')).toHaveCount(1);
  // The 8k picture is cut into tiles and sent to the GPU before measuring.
  await page.waitForTimeout(500);
  await expect(canvas).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
  await page.waitForTimeout(500);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Frame times while zooming in and out, panning, and moving a stamp.
  await page.mouse.move(mid.x, mid.y);
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -150);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 150);
  await page
    .getByRole('toolbar', { name: 'Map tools' })
    .getByRole('button', { name: 'Pan' })
    .click();
  await page.mouse.down();
  await page.mouse.move(mid.x - 200, mid.y - 150, { steps: 30 });
  await page.mouse.up();
  const frames = await page.evaluate(() =>
    (window as unknown as { __frames: number[] }).__frames.slice(1).sort((a, b) => a - b),
  );
  const median = frames[Math.floor(frames.length / 2)] ?? 0;
  const p90 = frames[Math.floor(frames.length * 0.9)] ?? 0;
  testInfo.annotations.push({
    type: 'frames',
    description: `${String(frames.length)} frames, median ${median.toFixed(1)} ms, p90 ${p90.toFixed(1)} ms`,
  });
  expect(median).toBeLessThan(50);

  // The export is the whole 8k map.
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 150_000 }),
    page
      .getByRole('dialog', { name: 'Export as a picture' })
      .getByRole('button', { name: 'Export' })
      .click(),
  ]);
  const file = testInfo.outputPath('world.png');
  await download.saveAs(file);
  expect(pngSize(readFileSync(file))).toEqual({ width: 8192, height: 8192 });
});

test('terrain textures, the eraser, and pins in categories', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Drawing is checked on the desktop; phones get the same tools.');
  test.setTimeout(90_000);
  await newMap(page, 'Sword Coast');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y });
  const drag = async (from: [number, number], to: [number, number]) => {
    await page.mouse.move(at(...from).x, at(...from).y);
    await page.mouse.down();
    await page.mouse.move(at(...to).x, at(...to).y, { steps: 12 });
    await page.mouse.up();
  };
  const strokes = async () =>
    page
      .getByRole('region', { name: 'Layers' })
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.reduce((n, li) => n + Number(li.querySelector('span')?.textContent ?? 0), 0),
      );

  // A river painted with the water texture.
  await tool(page, 'Terrain brush').click();
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Water' })
    .click();
  await drag([80, 250], [600, 260]);
  // The eraser cuts it in two.
  await tool(page, 'Eraser').click();
  await expect(page.getByRole('region', { name: 'Eraser' })).toBeVisible();
  await drag([340, 120], [340, 400]);
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(strokes).toBe(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(strokes).toBe(1);

  // A category of pins with its icon; a pin in it takes the icon (pins are the Viewer's).
  await switchMode(page, 'View map');
  await page.getByRole('tab', { name: 'Pins' }).click();
  await page.getByRole('button', { name: 'New category' }).click();
  const categories = page.getByRole('region', { name: 'Pin categories' });
  await categories.getByLabel('Name', { exact: true }).fill('Cities');
  await categories
    .getByRole('radiogroup', { name: 'Category icon' })
    .getByRole('radio', { name: 'Castle' })
    .click();
  await tool(page, 'Pin').click();
  await page.mouse.click(at(200, 150).x, at(200, 150).y);
  await page.getByLabel('Pin label').fill('Waterdeep');
  await page.getByLabel('Pin category').selectOption({ label: 'Cities' });
  await canvas.screenshot({ path: testInfo.outputPath('pins.png') });
  // Drawn as on a fantasy map: an inked castle, the name in italic.
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.getByLabel('Pin style').selectOption('fantasy');
  await waitForSaved(page, 'maps', '"pinStyle"');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('pins-fantasy.png') });
  // Hidden together, then shown again; kept after a reload.
  await page.getByRole('tab', { name: 'Pins' }).click();
  await page.getByRole('button', { name: 'Hide Cities' }).click();
  await expect(page.getByRole('button', { name: 'Show Cities' })).toBeVisible();
  await waitForSaved(page, 'maps', '"hidden":true');
  await page.reload();
  await page.getByRole('tab', { name: 'Pins' }).click();
  await expect(page.getByRole('button', { name: 'Show Cities' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Cities' }).click();
  // Zoomed far out, the pin keeps its size.
  await page.mouse.move(at(200, 150).x, at(200, 150).y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await canvas.screenshot({ path: testInfo.outputPath('pins-far.png') });
});

test('asset packs are imported as zips, browsed with previews, and their stamps placed', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  await installData(page);
  await newMap(page, 'Pack Village');
  const zip = Buffer.from(
    zipSync({
      'FA_Assets_Webp/Copyright.url': strToU8('[InternetShortcut]'),
      'FA_Assets_Webp/Desert/Town/Well_Stone_A1_2x2.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Desert/Town/Cart_Wood_B1_3x1.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Forest/Trees/Oak_A1_1x1.png': [PIXEL, { level: 0 }],
    }),
  );
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (
    await chooser
  ).setFiles({ name: 'Village_Pack_v1.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
  // Browsed by folder, with a count; the same zip again is recognised.
  const folders = page.getByRole('list', { name: 'Folders' });
  await expect(folders.getByRole('button', { name: /Desert/ })).toBeVisible();
  await folders.getByRole('button', { name: /Desert/ }).click();
  await page.getByRole('list', { name: 'Folders' }).getByRole('button', { name: /Town/ }).click();
  const pictures = page.getByRole('list', { name: 'Pack pictures' });
  await expect(pictures.getByRole('button')).toHaveCount(2);
  await expect(pictures.getByRole('button', { name: 'Well Stone A1' })).toBeVisible();
  await expect(pictures.locator('img').first()).toBeVisible();
  // A search looks through every folder.
  await page.getByRole('button', { name: 'All packs' }).click();
  await page.getByLabel('Find a pack picture').fill('oak');
  await expect(pictures.getByRole('button')).toHaveCount(1);
  await page.getByLabel('Find a pack picture').fill('well');
  await pictures.getByRole('button', { name: 'Well Stone A1' }).click();
  await expect(tool(page, 'Stamp')).toHaveAttribute('aria-pressed', 'true');
  // Placed at the size its name gives: 2 × 2 squares.
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + 300, box.y + 300);
  await waitForSaved(page, 'maps', '"stamp":"pack:');
  await waitForSaved(page, 'maps', '"w":140,"h":140');
  await canvas.screenshot({ path: testInfo.outputPath('pack-stamp.png') });
  // The pictures the map uses have a view of their own; a fuzzy search finds letters in order.
  await page.getByRole('tab', { name: 'Stamps', exact: true }).click();
  await page.getByLabel('Find a pack picture').fill('');
  await page.getByRole('button', { name: /^Used on this map \(1\)/ }).click();
  await expect(pictures.getByRole('button')).toHaveCount(1);
  await expect(pictures.getByRole('button', { name: 'Well Stone A1' })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Find a pack picture').fill('wll');
  await expect(pictures.getByRole('button')).toHaveCount(0);
  await page.getByLabel('Fuzzy search').check();
  await expect(pictures.getByRole('button')).toHaveCount(1);
  await page.getByLabel('Fuzzy search').uncheck();
  await page.getByLabel('Find a pack picture').fill('');
  // Importing the same zip again adds nothing.
  await page.getByRole('tab', { name: 'Stamps', exact: true }).click();
  const again = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (
    await again
  ).setFiles({ name: 'Village_Pack_v1 (1).zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('status').filter({ hasText: 'already here' })).toBeVisible();
  // Kept after a reload, and the pack can be removed.
  await page.reload();
  await expect(canvas.locator('canvas')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Stamps', exact: true }).click();
  await page.getByRole('button', { name: /^Packs \(1\)/ }).click();
  await page.getByRole('button', { name: /^Remove Village Pack v1/ }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('No packs yet')).toBeVisible();
});

test('on a phone the panels open over the map', async ({ page }) => {
  test.skip(!isPhone(page), 'The phone layout.');
  await newMap(page, 'Keep');
  await expect(page.getByRole('complementary', { name: 'Map panels' })).toBeHidden();
  await page.getByRole('button', { name: 'Panels' }).click();
  await expect(page.getByRole('complementary', { name: 'Map panels' })).toBeVisible();
  await page.getByRole('button', { name: 'Close panels' }).click();
  await expect(page.getByRole('toolbar', { name: 'Map tools' })).toBeVisible();
});

test('Send to → Map pins a compendium entry on a new map', async ({ page }) => {
  await installData(page);
  await page.goto(`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New map with Goblin/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await expect(page.getByRole('textbox', { name: 'Map name' })).toHaveValue('Map');
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(
    page.getByRole('region', { name: 'Layers' }).getByRole('listitem').first(),
  ).toContainText('1');
  if (isPhone(page)) return;
  // Ctrl+click on the pin, while editing: its entry opens in a new tab.
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await page.keyboard.down('Control');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 12);
  await page.keyboard.up('Control');
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Goblin/);
});

/** A 1×1 PNG every browser decodes. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('picture layers and variants: a night version, switched in the Viewer', async ({ page }) => {
  await installData(page);
  await newMap(page, 'Abandoned Mine');
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  const pick = async (name: string) => {
    await page
      .getByLabel('Add a picture layer')
      .setInputFiles({ name, mimeType: 'image/png', buffer: PIXEL });
  };
  await pick('Mine_Day.png');
  await expect(page.getByLabel('Layer name').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide Mine Day' })).toBeVisible();
  await pick('Mine_Night.png');
  await expect(page.getByRole('button', { name: 'Hide Mine Night' })).toBeVisible();
  // Two variants: the day (night hidden) and the night.
  await page.getByRole('button', { name: 'Hide Mine Night' }).click();
  await page.getByRole('button', { name: 'New variant' }).click();
  await page.getByLabel('Variant name').nth(0).fill('Day');
  await page.getByRole('button', { name: 'New variant' }).click();
  await page.getByLabel('Variant name').nth(1).fill('Night');
  await page.getByRole('button', { name: 'Show Mine Night' }).click();
  await waitForSaved(page, 'maps', '"name":"Night"');
  // The Viewer switches between them.
  await page.getByRole('link', { name: /View map/ }).click();
  const variant = page.getByLabel('Variant', { exact: true });
  await expect(variant).toHaveValue(/.+/);
  await variant.selectOption({ label: 'Day' });
  await waitForSaved(page, 'maps', '"activeVariant"');
  await page.reload();
  await expect(page.getByLabel('Variant', { exact: true })).toHaveValue(/.+/);
  await expect(page.getByLabel('Variant', { exact: true }).locator('option:checked')).toHaveText(
    'Day',
  );
});

test('a map of the first version is converted when opened: pictures become layers and variants', async ({
  page,
}) => {
  await installData(page);
  await page.goto('./#/maps');
  const id = 'abc123';
  await page.evaluate(async (mapId) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (
      await root.getDirectoryHandle('user-data', { create: true })
    ).getDirectoryHandle('maps', { create: true });
    const file = await dir.getFileHandle(mapId + '.json', { create: true });
    const w = await file.createWritable();
    await w.write(
      JSON.stringify({
        version: 1,
        id: mapId,
        name: 'Old Crypt',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        width: 100,
        height: 100,
        background: { path: 'maps/assets/day.png', width: 800, height: 600 },
        pictures: [{ name: 'Night', path: 'maps/assets/night.png', visible: true }],
        grid: { type: 'square', size: 70, offsetX: 0, offsetY: 0, feet: 5, opacity: 0.35 },
        layers: [
          {
            id: 'l1',
            name: 'Pins',
            visible: true,
            locked: false,
            items: [{ kind: 'pin', id: 'p1', x: 50, y: 50, label: 'Altar' }],
          },
        ],
      }),
    );
    await w.close();
  }, id);
  await page.reload();
  await page.goto('./#/maps/' + id);
  await expect(page.getByLabel('Variant', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Variant', { exact: true }).locator('option:checked')).toHaveText(
    'As it was',
  );
  // Saved again in the new format.
  await waitForSaved(page, 'maps', '"version":2');
  await waitForSaved(page, 'maps', '"label":"Altar"');
});

test('the maps list finds maps by name, folder and tag, with their thumbnails', async ({
  page,
}) => {
  await installData(page);
  await newMap(page, 'Pirate Tavern');
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page
    .getByLabel('Add a picture layer')
    .setInputFiles({ name: 'tavern.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(page.getByRole('button', { name: 'Hide tavern' })).toBeVisible();
  await page.getByRole('tab', { name: 'Map' }).click();
  const filing = page.getByRole('region', { name: 'Filed under' });
  await filing.getByLabel('Folder').fill('Battle maps/Taverns');
  await filing.getByLabel('Tags').fill('Tavern, night');
  await filing.getByLabel('Folder').click();
  await waitForSaved(page, 'maps', '"tags":["tavern","night"]');
  await newMap(page, 'Goblin Bridge');

  await page.goto('./#/maps');
  const library = page.getByRole('region', { name: 'Map library' });
  await expect(library.getByRole('link', { name: /Pirate Tavern/ }).locator('img')).toBeVisible();
  await page.getByLabel('Search maps').fill('tavern');
  await expect(library.getByRole('link')).toHaveCount(1);
  await page.getByLabel('Search maps').fill('');
  await page.getByRole('group', { name: 'Tags' }).getByRole('button', { name: /night/ }).click();
  await expect(library.getByRole('link')).toHaveCount(1);
  await page.getByRole('group', { name: 'Tags' }).getByRole('button', { name: /night/ }).click();
  await page.getByLabel('Folder').selectOption({ label: 'Battle maps › Taverns' });
  await expect(library.getByRole('link', { name: /Pirate Tavern/ })).toBeVisible();
  await expect(library.getByRole('link', { name: /Goblin Bridge/ })).toHaveCount(0);
});

test('a world map measures distances, and a route moves the calendar on', async ({ page }) => {
  test.skip(isPhone(page), 'Measuring by dragging is checked on the desktop.');
  await installData(page);
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/calendar');
  await page.getByRole('button', { name: 'Start a calendar' }).click();
  await expect(page.getByRole('region', { name: 'Today' })).toContainText('1 Deepwinter, Year 1');

  await newMap(page, 'The Sunash Sea');
  // The Creator draws: no pins, routes or spell templates there.
  await expect(tool(page, 'Wall')).toBeVisible();
  await expect(tool(page, 'Route')).toHaveCount(0);
  await expect(tool(page, 'Spell template')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.getByRole('region', { name: 'Grid' })).toBeVisible();
  const scale = page.getByRole('region', { name: 'Scale and travel' });
  await scale.getByLabel('Unit').selectOption('km');
  await scale.getByLabel('Distance across the map').fill('28000');
  await scale.getByRole('button', { name: 'Add a speed' }).click();
  await scale.getByLabel('Speed 1 name').fill('Skiff');
  await scale.getByLabel('Speed 1 per day').fill('1400');
  await scale.getByLabel('Distance across the map').click();
  await waitForSaved(
    page,
    'campaigns/rust-and-sunfire/maps',
    '"travel":[{"name":"Skiff","perDay":1400}]',
  );

  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Measure').click();
  await page.mouse.click(box.x + 100, box.y + 300);
  await page.mouse.click(box.x + 400, box.y + 300);
  await expect(
    page.getByRole('status').filter({ hasText: /Distance: [\d,]+ km · Skiff: (\d|about)/ }),
  ).toBeVisible();

  // A route, stop by stop, says how far it goes so far (routes are the Viewer's).
  await switchMode(page, 'View map');
  await expect(tool(page, 'Route')).toBeVisible();
  await expect(tool(page, 'Wall')).toHaveCount(0);
  await tool(page, 'Route').click();
  await page.mouse.click(box.x + 100, box.y + 200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.mouse.click(box.x + 300, box.y + 350);
  await expect(page.getByRole('status').filter({ hasText: /[\d,]+ km · Skiff:/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'campaigns/rust-and-sunfire/maps', '"kind":"route"');

  // Picked, it shows the journey; its days move the campaign's calendar on.
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  const journey = page.getByRole('region', { name: 'Route' }).getByLabel('Journey');
  await expect(journey).toContainText(/[\d,]+ km/);
  await journey.getByRole('button', { name: /Advance the calendar \d+ days? \(Skiff\)/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /Today is now/ })).toBeVisible();
  await page.goto('./#/calendar');
  await expect(page.getByRole('region', { name: 'Today' })).not.toContainText(
    '1 Deepwinter, Year 1',
  );
});

test('a pin leads to a note: clicked on a board, the note opens beside the map', async ({
  page,
}, testInfo) => {
  await installData(page);
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/journal');
  await newNote(page, 'Gull’s Rest');

  await newMap(page, 'Coast');
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await switchMode(page, 'View map');
  await tool(page, 'Pin').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByLabel('Pin label').fill('Gull’s Rest');
  await page.getByLabel('Pin leads to').selectOption({ label: 'A journal note' });
  // Notes are found by typing part of their name.
  await page.getByRole('searchbox', { name: 'Pin note' }).fill('gull');
  await page
    .getByRole('list', { name: 'Notes' })
    .getByRole('button', { name: /Gull’s Rest/ })
    .click();
  await page.getByLabel('Hidden from players').check();
  await waitForSaved(page, 'campaigns/rust-and-sunfire/maps', '"secret":true');
  await waitForSaved(page, 'campaigns/rust-and-sunfire/maps', '"note":"Gull’s Rest.md"');

  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Session 1');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Map…' }).click();
  await page.getByRole('list', { name: 'Maps' }).getByRole('button', { name: 'Coast' }).click();
  const map = page.getByRole('img', { name: 'Map: Coast' });
  await expect(map).toBeVisible();
  await expect(map.locator('canvas')).toHaveCount(1);
  const card = await map.boundingBox();
  if (!card) throw new Error('no map card');
  // Resting the mouse on the pin previews its note.
  if (testInfo.project.name === 'desktop') {
    await page.mouse.move(card.x + card.width / 2 - 3, card.y + card.height / 2 - 3);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    const preview = page.getByRole('tooltip', { name: 'Preview: Gull’s Rest' });
    await expect(preview).toBeVisible();
    // The mouse can go onto the preview (to scroll it) without it closing.
    const tip = await preview.boundingBox();
    if (!tip) throw new Error('no preview');
    await page.mouse.move(tip.x + tip.width / 2, tip.y + 20, { steps: 4 });
    await page.waitForTimeout(600);
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS('overflow-y', 'auto');
    // Leaving it closes it.
    await page.mouse.move(tip.x + tip.width + 200, tip.y + tip.height + 200);
    await expect(preview).toHaveCount(0);
    await page.mouse.move(card.x + card.width / 2 - 3, card.y + card.height / 2 - 3);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await expect(preview).toBeVisible();
    // The wheel over the map zooms the board, not the map inside the card.
    const viewport = page.locator('.react-flow__viewport');
    const before = await viewport.getAttribute('style');
    await page.mouse.wheel(0, -300);
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(before);
    await page.mouse.wheel(0, 300);
    const after = await map.boundingBox();
    if (!after) throw new Error('no map card');
    await page.mouse.move(after.x + after.width / 2, after.y + after.height / 2);
  }
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  // The card's ruler measures a path too.
  const tools = page.getByRole('toolbar', { name: 'Map tools' });
  await tools.getByRole('button', { name: 'Measure' }).click();
  const now = await map.boundingBox();
  if (!now) throw new Error('no map card');
  await page.mouse.click(now.x + 20, now.y + 20);
  await page.mouse.click(now.x + now.width - 20, now.y + 20);
  await page.mouse.click(now.x + now.width - 20, now.y + now.height - 20);
  await expect(page.getByRole('status', { name: 'Measured' })).toHaveText(/\d/);
  await tools.getByRole('button', { name: 'Look around' }).click();
  // The note card is added beside the map (off screen on a phone: the board file says so).
  await waitForSaved(page, 'campaigns/rust-and-sunfire/boards', '"path": "Gull’s Rest.md"');
  if (testInfo.project.name !== 'desktop') return;
  const noteCards = page
    .locator('.react-flow__node')
    .filter({ has: page.getByRole('heading', { name: 'Gull’s Rest', exact: true }) });
  await expect(noteCards).toHaveCount(1);
  // Locked, the map stays put and a drag over it moves the board.
  await page.getByRole('button', { name: 'Lock the map' }).click();
  await expect(
    page.getByRole('toolbar', { name: 'Map tools' }).getByRole('button', { name: 'Zoom in' }),
  ).toBeDisabled();
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.getAttribute('style');
  const locked = await map.boundingBox();
  if (!locked) throw new Error('no map card');
  await page.mouse.move(locked.x + 40, locked.y + 40);
  await page.mouse.down();
  await page.mouse.move(locked.x + 140, locked.y + 90, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(before);
  // Following the pin again brings that card into view; no second one.
  const again = await map.boundingBox();
  if (!again) throw new Error('no map card');
  await page.mouse.click(again.x + again.width / 2, again.y + again.height / 2);
  await page.waitForTimeout(600);
  await expect(noteCards).toHaveCount(1);
});

test('region names lettered as on an old map, dashed routes, measuring from a pin', async ({
  page,
}) => {
  test.skip(isPhone(page), 'Drawn and measured on the desktop.');
  await newMap(page, 'The Westlands');
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');

  await tool(page, 'Text').click();
  await page.mouse.click(box.x + 300, box.y + 150);
  const text = page.getByRole('region', { name: 'Text' });
  await text.getByLabel('Text').fill('THE WHISPERING WOODS');
  await text.getByLabel('Lettering').selectOption('fantasy');
  await text.getByLabel(/Curve/).fill('40');
  await waitForSaved(page, 'maps', '"curve":40');

  await switchMode(page, 'View map');
  await tool(page, 'Route').click();
  await page.mouse.click(box.x + 100, box.y + 300);
  await page.mouse.click(box.x + 500, box.y + 320);
  await page.keyboard.press('Enter');
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 300, box.y + 310);
  await page.getByRole('region', { name: 'Route' }).getByLabel('Line').selectOption('dashed');
  await waitForSaved(page, 'maps', '"dash":"dashed"');

  await tool(page, 'Pin').click();
  await page.mouse.click(box.x + 150, box.y + 450);
  await page.getByLabel('Pin label').fill('Thornwick');
  await page.getByRole('button', { name: 'Measure from here' }).click();
  await expect(tool(page, 'Measure')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(box.x + 450, box.y + 450);
  await expect(page.getByRole('status').filter({ hasText: /Distance:/ })).toBeVisible();
});

test('a scale bar, plain or as on an old map', async ({ page }) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  await newMap(page, 'The Sunash Sea');
  await page.getByRole('tab', { name: 'Map' }).click();
  const scale = page.getByRole('region', { name: 'Scale and travel' });
  await scale.getByLabel('Unit').selectOption('mi');
  await scale.getByLabel('Distance across the map').fill('1400');
  await scale.getByLabel('Unit').click();
  await page.getByRole('combobox', { name: 'Scale bar' }).selectOption('fantasy');
  await waitForSaved(page, 'maps', '"scaleBar":"fantasy"');
  await page.getByRole('combobox', { name: 'Scale bar' }).selectOption('plain');
  await waitForSaved(page, 'maps', '"scaleBar":"plain"');
});

test('the Creator draws the map and the Viewer uses it', async ({ page }) => {
  await newMap(page, 'Split Keep');
  // New maps open in the Creator: art tools, no pins, routes or spell templates.
  await expect(tool(page, 'Stamp')).toBeVisible();
  await expect(tool(page, 'Terrain brush')).toBeVisible();
  await expect(tool(page, 'Pin')).toHaveCount(0);
  await expect(tool(page, 'Spell template')).toHaveCount(0);
  await switchMode(page, 'View map');
  await expect(page).toHaveURL(/#\/maps\/[^/]+$/);
  await expect(tool(page, 'Pin')).toBeVisible();
  await expect(tool(page, 'Spell template')).toBeVisible();
  await expect(tool(page, 'Measure')).toBeVisible();
  await expect(tool(page, 'Stamp')).toHaveCount(0);
  await expect(tool(page, 'Terrain brush')).toHaveCount(0);
  await switchMode(page, 'Edit map');
  await expect(page).toHaveURL(/#\/maps\/[^/]+\/edit$/);
  await expect(tool(page, 'Stamp')).toBeVisible();
});

test('fog hides areas from the players until they are revealed', async ({ page }) => {
  test.skip(isPhone(page), 'Dragged on the desktop.');
  await newMap(page, 'Fogged Crypt');
  await switchMode(page, 'View map');
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Fog').click();
  await expect(page.getByRole('region', { name: 'Fog' })).toBeVisible();
  // Everything is covered, then a hole is cut where the party stands.
  await page.getByRole('button', { name: 'Cover the whole map' }).click();
  await expect(page.getByRole('list', { name: 'Fog areas' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Reveal' }).click();
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 350, { steps: 6 });
  await page.mouse.up();
  const areas = page.getByRole('list', { name: 'Fog areas' }).getByRole('listitem');
  await expect(areas).toHaveCount(2);
  await expect(areas.nth(1)).toContainText('Revealed');
  await waitForSaved(page, 'maps', '"revealed":true');
  // Hidden again, then removed.
  await page.getByRole('button', { name: 'Hide fog area 2' }).click();
  await expect(areas.nth(1)).toContainText('Hidden');
  await page.getByRole('button', { name: 'Clear all fog' }).click();
  await expect(areas).toHaveCount(0);
});

test('the Creator makes a flat picture of the art that the Viewer shows', async ({ page }) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'Flat Fort');
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Brush').click();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 8 });
  await page.mouse.up();
  // A few seconds later the picture is made and kept with the map.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const assets = await (
              await (await root.getDirectoryHandle('user-data')).getDirectoryHandle('maps')
            ).getDirectoryHandle('assets');
            for await (const [name] of assets.entries())
              if (name.startsWith('render-') && name.endsWith('.webp')) return true;
          } catch {
            // The folder is not there yet.
          }
          return false;
        }),
      { timeout: 45_000 },
    )
    .toBe(true);
  await switchMode(page, 'View map');
  await expect(page.getByRole('application', { name: 'Map canvas' }).locator('canvas')).toHaveCount(
    1,
  );
});

test('terrain shapes, islands, roads and rivers are drawn and edited', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'The Isles');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y });
  const click = async (x: number, y: number) => {
    await page.mouse.click(at(x, y).x, at(x, y).y);
  };
  const counts = async () =>
    page
      .getByRole('region', { name: 'Layers' })
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.reduce((n, li) => n + Number(li.querySelector('span')?.textContent ?? 0), 0),
      );

  // The sea, then land with a coast.
  await tool(page, 'Terrain shape').click();
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Water' })
    .click();
  await page.getByRole('button', { name: 'Cover the whole map' }).click();
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Grass' })
    .click();
  await page.getByRole('button', { name: 'Generate an island' }).click();
  await waitForSaved(page, 'maps', '"kind":"shape"');
  // A shape of its own, point by point; Enter closes it.
  await click(120, 120);
  await click(300, 100);
  await click(340, 220);
  await click(180, 260);
  await page.keyboard.press('Enter');
  // A river from the hills towards the sea, and a road.
  await tool(page, 'Road or river').click();
  await page.getByLabel('Path kind').selectOption('river');
  await click(200, 140);
  await click(260, 200);
  await click(300, 330);
  await page.keyboard.press('Enter');
  await page.getByLabel('Path kind').selectOption('road');
  await click(100, 300);
  await click(250, 280);
  await click(400, 330);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"style":"river"');
  await waitForSaved(page, 'maps', '"style":"road"');
  await page.getByRole('tab', { name: 'Layers' }).click();
  // Sea, island, hand-drawn shape, river, road.
  await expect.poll(counts).toBe(5);
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('isles.png') });

  // Picked, a shape shows its settings and handles; Escape while drawing cancels.
  await tool(page, 'Select and move').click();
  await click(150, 170);
  await expect(page.getByRole('region', { name: 'Terrain shape' })).toBeVisible();
  await tool(page, 'Road or river').click();
  await click(50, 50);
  await click(80, 90);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(counts).toBe(5);
  // Undo takes the road back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(counts).toBe(4);
});

test('scatter fills areas and lines with trees and mountains, clear of roads', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'The Greenwood');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const cx = box.width / 2;
  const cy = box.height / 2;
  const click = async (x: number, y: number) => {
    await page.mouse.click(box.x + x, box.y + y);
  };
  await tool(page, 'Terrain shape').click();
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Water' })
    .click();
  await page.getByRole('button', { name: 'Cover the whole map' }).click();
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Grass' })
    .click();
  await page.getByRole('slider', { name: /^Size/ }).fill('0.3');
  await page.getByRole('button', { name: 'Generate an island' }).click();
  await waitForSaved(page, 'maps', '"kind":"shape"');
  // A road across the island, then a forest scattered inside it.
  await tool(page, 'Road or river').click();
  await click(cx - 160, cy - 40);
  await click(cx, cy - 30);
  await click(cx + 160, cy - 60);
  await page.keyboard.press('Enter');
  await tool(page, 'Select and move').click();
  await click(cx - 30, cy + 40);
  await expect(page.getByRole('region', { name: 'Terrain shape' })).toBeVisible();
  await page.getByRole('button', { name: 'Scatter inside this' }).click();
  await waitForSaved(page, 'maps', '"within"');
  // Mountains along a line you draw.
  await tool(page, 'Scatter').click();
  await page.getByRole('radio', { name: /Mountain range/ }).click();
  await click(cx - 200, cy + 150);
  await click(cx - 60, cy + 120);
  await click(cx + 100, cy + 150);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"mode":"along"');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('greenwood.png') });
  // The pieces can be turned into loose stamps.
  await page.getByRole('button', { name: 'Bake into stamps' }).click();
  await waitForSaved(page, 'maps', '"stamp":"glyph:mountain"');
});

test('a town is generated from outlines, with walls, houses and a saved building', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(120_000);
  await newMap(page, 'Highmoor');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const cx = box.width / 2;
  const cy = box.height / 2;
  const click = async (x: number, y: number) => {
    await page.mouse.click(box.x + x, box.y + y);
  };
  // A walled town in one click.
  await tool(page, 'District').click();
  await page.getByRole('button', { name: 'Generate a walled town' }).click();
  await waitForSaved(page, 'maps', '"wall":true');
  // A road through it: houses move out of its way.
  await tool(page, 'Road or river').click();
  await click(cx - 220, cy + 10);
  await click(cx, cy - 10);
  await click(cx + 220, cy + 20);
  await page.keyboard.press('Enter');
  // A district of its own, drawn: a noble quarter outside the walls.
  await tool(page, 'District').click();
  await page.getByRole('radio', { name: /Noble quarter/ }).click();
  await click(cx + 130, cy - 200);
  await click(cx + 280, cy - 200);
  await click(cx + 280, cy - 90);
  await click(cx + 130, cy - 90);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"style":"noble"');
  // A building by hand, saved to the library, then placed again with a click.
  await tool(page, 'Building').click();
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 90, { steps: 4 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"kind":"building"');
  await page.getByLabel('Building name').fill('Smithy');
  await page.getByRole('button', { name: 'Save to the library' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await tool(page, 'Building').click();
  await page.getByRole('button', { name: 'Smithy', exact: true }).click();
  await click(60, 150);
  await page.waitForTimeout(1200);
  await canvas.screenshot({ path: testInfo.outputPath('highmoor.png') });
  await waitForSaved(page, 'maps', '"name":"Smithy"');
  // Picked, a district bakes into buildings of its own.
  await tool(page, 'Select and move').click();
  await click(cx + 200, cy - 150);
  await page.getByRole('button', { name: 'Bake into buildings' }).click();
  await waitForSaved(page, 'maps', '"density":0');
});

test('rooms with walls and doors, a generated dungeon and a cave', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'Under Highmoor');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Room').click();
  await page.getByRole('button', { name: 'Generate a dungeon' }).click();
  await waitForSaved(page, 'maps', '"kind":"room"');
  await waitForSaved(page, 'maps', '"doors"');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('dungeon-generated.png') });
  // A room of your own, dragged on the grid, and a door cut in its top wall.
  await page
    .getByRole('radiogroup', { name: 'Terrain' })
    .getByRole('radio', { name: 'Wood floor' })
    .click();
  await page.mouse.move(box.x + 40, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 130, { steps: 5 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"floor":"wood"');
  await tool(page, 'Door').click();
  await page.getByRole('radio', { name: 'Archway' }).click();
  await page.mouse.click(box.x + 90, box.y + 61);
  await waitForSaved(page, 'maps', '"kind":"arch"');
  await tool(page, 'Room').click();
  await page.getByRole('button', { name: 'Generate a cave' }).click();
  await waitForSaved(page, 'maps', '"wallStyle":"cave"');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('dungeon.png') });
});

test('mirrored drawing, and several items picked to line up', async ({ page }) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'Twin Halls');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const counts = async () =>
    page
      .getByRole('region', { name: 'Layers' })
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.reduce((n, li) => n + Number(li.querySelector('span')?.textContent ?? 0), 0),
      );
  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    await page.mouse.move(box.x + x0, box.y + y0);
    await page.mouse.down();
    await page.mouse.move(box.x + x1, box.y + y1, { steps: 5 });
    await page.mouse.up();
  };
  // Drawn once, made four times.
  await page.getByLabel('Mirror').selectOption('xy');
  await tool(page, 'Brush').click();
  await drag(120, 120, 200, 180);
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(counts).toBe(4);
  await page.getByLabel('Mirror').selectOption('off');
  // Two rooms, both picked, then lined up by their left edges.
  await tool(page, 'Room').click();
  await drag(200, 250, 280, 310);
  await drag(300, 330, 380, 400);
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 240, box.y + 280);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 340, box.y + 365);
  await page.keyboard.up('Shift');
  const arrange = page.getByRole('region', { name: 'Selection' });
  await expect(arrange).toBeVisible();
  await arrange.getByRole('button', { name: 'Align left edges' }).click();
  await arrange.getByRole('button', { name: 'Remove the 2 items' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(counts).toBe(4);
});

test('a label runs along a river, and the paper can be changed', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(60_000);
  await newMap(page, 'The Silverrun');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const click = async (x: number, y: number) => {
    await page.mouse.click(box.x + x, box.y + y);
  };
  await tool(page, 'Road or river').click();
  await page.getByLabel('Path kind').selectOption('river');
  await click(100, 200);
  await click(250, 150);
  await click(420, 260);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"style":"river"');
  // Clicking the river with the Text tool makes a label that follows it.
  await tool(page, 'Text').click();
  await click(250, 150);
  await waitForSaved(page, 'maps', '"text":"River"');
  await waitForSaved(page, 'maps', '"follow"');
  await expect(page.getByLabel('Label runs along')).toHaveValue(/.+/);
  await page.getByRole('region', { name: 'Text' }).getByLabel('Text').fill('Silverrun');
  await waitForSaved(page, 'maps', '"text":"Silverrun"');
  // Another paper.
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.getByLabel('Kind of paper').selectOption('night');
  await waitForSaved(page, 'maps', '"paper":"night"');
  await page.waitForTimeout(600);
  await canvas.screenshot({ path: testInfo.outputPath('silverrun.png') });
});

test('elevation is made, painted and shown as hill shading', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Painted on the desktop.');
  test.setTimeout(60_000);
  await newMap(page, 'The Spine');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Elevation').click();
  await page.getByRole('button', { name: 'Generate terrain' }).click();
  await waitForSaved(page, 'maps', '"elevation"');
  await expect(page.getByRole('radio', { name: /Raise/ })).toBeChecked();
  // A ridge painted on top.
  await page.mouse.move(box.x + 150, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 200, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('spine.png') });
  // Hidden by taking the shading to nothing; gone with Remove.
  await page.getByRole('slider', { name: /^How much it shows/ }).fill('0');
  await page.getByRole('button', { name: 'Remove the elevation' }).click();
  await expect(page.getByRole('button', { name: 'Start with flat land' })).toBeVisible();
});

test('a room is furnished, and the Viewer finds pins by name', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await newMap(page, 'The Gull and Anchor');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Room').click();
  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 360, box.y + 300, { steps: 6 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"kind":"room"');
  // The room is picked: furnish it as a tavern.
  await page.getByRole('button', { name: 'Tavern' }).click();
  await waitForSaved(page, 'maps', '"within"');
  await waitForSaved(page, 'maps', 'glyph:table');
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: testInfo.outputPath('tavern.png') });
  // In the Viewer: a pin, found by typing part of its name.
  await switchMode(page, 'View map');
  await tool(page, 'Pin').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.getByLabel('Pin label').fill('Bar Maid Brunhild');
  await waitForSaved(page, 'maps', 'Bar Maid Brunhild');
  const search = page.getByRole('combobox', { name: 'Find on the map' });
  await search.fill('brunh');
  const result = page.getByRole('listbox', { name: 'Results' }).getByRole('button');
  await expect(result).toHaveCount(1);
  await result.click();
  await search.fill('nobody');
  await expect(page.getByText('Nothing by that name.')).toBeVisible();
});

test('a map moves between the library and a campaign with its pictures', async ({ page }) => {
  test.setTimeout(60_000);
  await installData(page);
  await createCampaign(page, 'Rust and Sunfire');
  await newMap(page, 'Mover');
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page
    .getByLabel('Add a picture layer')
    .setInputFiles({ name: 'Mover_Day.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(page.getByRole('button', { name: 'Hide Mover Day' })).toBeVisible();
  await page.getByRole('tab', { name: 'Map' }).click();
  await waitForSaved(page, 'campaigns/rust-and-sunfire/maps', '"name":"Mover"');
  // To the library.
  await page.getByLabel('Where the map lives').selectOption('');
  await waitForSaved(page, 'maps', '"name":"Mover"');
  await expect(page.getByLabel('Where the map lives')).toHaveValue('');
  // The picture came too.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          try {
            const root = await navigator.storage.getDirectory();
            const assets = await (
              await (await root.getDirectoryHandle('user-data')).getDirectoryHandle('maps')
            ).getDirectoryHandle('assets');
            for await (const [name] of assets.entries())
              if (name.startsWith('Mover_Day')) return true;
          } catch {
            // not there yet
          }
          return false;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  // And back into the campaign.
  await page.getByLabel('Where the map lives').selectOption({ label: 'Rust and Sunfire' });
  await expect(page.getByLabel('Where the map lives')).not.toHaveValue('');
});

test('a folder of a pack becomes the mix of a scatter', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'Drawn on the desktop.');
  test.setTimeout(90_000);
  await installData(page);
  await newMap(page, 'Pack Woods');
  const zip = Buffer.from(
    zipSync({
      'FA_Assets_Webp/Forest/Trees/Oak_A1_2x2.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Forest/Trees/Oak_B1_2x2.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Forest/Trees/Bush_A1_1x1.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Forest/Rocks/Rock_A1_1x1.png': [PIXEL, { level: 0 }],
    }),
  );
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (
    await chooser
  ).setFiles({ name: 'Forest_Pack.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
  const folders = page.getByRole('list', { name: 'Folders' });
  await folders.getByRole('button', { name: /Forest/ }).click();
  await page.getByRole('list', { name: 'Folders' }).getByRole('button', { name: /Trees/ }).click();
  await page.getByRole('button', { name: /Scatter these \(3\)/ }).click();
  await expect(tool(page, 'Scatter')).toHaveAttribute('aria-pressed', 'true');
  // The mix now holds the three pictures.
  await expect(
    page.getByRole('list', { name: 'Stamps in the mix' }).getByRole('listitem'),
  ).toHaveCount(3);
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  for (const [x, y] of [
    [150, 150],
    [450, 160],
    [460, 380],
    [140, 360],
  ] as const)
    await page.mouse.click(box.x + x, box.y + y);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"kind":"scatter"');
  await waitForSaved(page, 'maps', '"ref":"pack:');
  // Baked, the pictures keep their own sizes on the grid.
  await page.getByRole('button', { name: 'Bake into stamps' }).click();
  await waitForSaved(page, 'maps', '"stamp":"pack:');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('pack-woods.png') });
});

test('a pin leads to a board of the campaign', async ({ page }) => {
  test.skip(isPhone(page), 'Pins are placed on the desktop.');
  test.setTimeout(60_000);
  await installData(page);
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Session One');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  await newMap(page, 'Gateway');
  await switchMode(page, 'View map');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Pin').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.getByLabel('Pin leads to').selectOption({ label: 'A character, board, encounter…' });
  await page.getByLabel('Kind of page').selectOption('boards');
  await page.getByLabel('Page', { exact: true }).selectOption({ label: 'Session One' });
  await waitForSaved(page, 'campaigns/rust-and-sunfire/maps', '"page":"/boards/');
});

test('the bottom bar shows the grid and snap, G and S switch them, and items can go under the others', async ({
  page,
}) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Bar');
  const bar = page.getByRole('toolbar', { name: 'Map bar' });
  const grid = bar.getByRole('button', { name: 'Grid' });
  const snap = bar.getByRole('button', { name: 'Snap' });
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('g');
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  await expect(snap).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('s');
  await expect(snap).toHaveAttribute('aria-pressed', 'false');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + 300, box.y + 200);
  await expect(bar.getByLabel('Square under the cursor')).not.toHaveText('–');
  await tool(page, 'Wall').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.dblclick(box.x + 400, box.y + 200);
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.getByLabel("Under the layer's other items").check();
  await waitForSaved(page, 'maps', '"under":true');
});

test('a texture of an imported pack paints terrain', async ({ page }) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  test.setTimeout(60_000);
  await installData(page);
  await newMap(page, 'Pack Meadow');
  const zip = Buffer.from(
    zipSync({
      'FA_Assets_Webp/Woodlands/!Wilderness/Textures/Grass/Grass_A_01.png': [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Woodlands/!Wilderness/Flora/Oak_A1_1x1.png': [PIXEL, { level: 0 }],
    }),
  );
  await tool(page, 'Terrain brush').click();
  await expect(page.getByText('No textures yet')).toBeVisible();
  await tool(page, 'Stamp').click();
  await page.getByRole('tab', { name: 'Stamps', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (await chooser).setFiles({ name: 'Meadow.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
  await tool(page, 'Terrain brush').click();
  const textures = page.getByRole('list', { name: 'Pack textures' });
  // Only the texture, not the 1×1 oak.
  await expect(textures.getByRole('button')).toHaveCount(1);
  await textures.getByRole('button', { name: 'Grass A 01' }).click();
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 260, { steps: 6 });
  await page.mouse.up();
  await waitForSaved(page, 'maps', '"texture":"pack:');
});

test('walls are made of a pack strip, and its doors snap onto them', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'The Creator is used on the desktop.');
  test.setTimeout(60_000);
  await installData(page);
  await newMap(page, 'Pack Keep');
  const zip = Buffer.from(
    zipSync({
      'FA_Assets_Webp/Core/Building/Walls_and_Curbs/Wall_Stone_B/Wall_Stone_Earthy_B1_Straight_Path.png':
        [PIXEL, { level: 0 }],
      'FA_Assets_Webp/Core/Building/Doors/Door_Wood_Brown_A_1x1.png': [PIXEL, { level: 0 }],
    }),
  );
  await tool(page, 'Stamp').click();
  await page.getByRole('tab', { name: 'Stamps', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (await chooser).setFiles({ name: 'Keep.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('status').filter({ hasText: '1 added' })).toBeVisible();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  // A wall in the pack's style.
  await tool(page, 'Wall').click();
  await page
    .getByRole('list', { name: 'Wall styles' })
    .getByRole('button', { name: 'Stone Earthy B1' })
    .click();
  await page.mouse.click(box.x + 200, box.y + 300);
  await page.mouse.dblclick(box.x + 500, box.y + 300);
  await waitForSaved(page, 'maps', '"texture":"pack:');
  // A door of the pack, clicked a little off the wall, lands on it.
  await tool(page, 'Stamp').click();
  await page.getByLabel('Find a pack picture').fill('door');
  await page
    .getByRole('list', { name: 'Pack pictures' })
    .getByRole('button', { name: 'Door Wood Brown A' })
    .click();
  await page.mouse.click(box.x + 350, box.y + 312);
  await waitForSaved(page, 'maps', '"rotation":0');
  await canvas.screenshot({ path: testInfo.outputPath('pack-wall.png') });
});

/** The points of every wall saved in the user's maps. */
const savedWalls = (page: Page) =>
  page.evaluate(async () => {
    const walls: number[][] = [];
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('user-data')).getDirectoryHandle('maps');
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        const doc = JSON.parse(await (await entry.getFile()).text()) as {
          layers?: { items: { kind: string; points?: number[] }[] }[];
        };
        for (const layer of doc.layers ?? [])
          for (const item of layer.items)
            if (item.kind === 'wall' && item.points) walls.push(item.points);
      }
    } catch {
      return walls;
    }
    return walls;
  });

test('Backspace takes the last point back while drawing, and Delete over a point removes it', async ({
  page,
}) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Points');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  // Points land where they are clicked, not on the grid.
  await page.keyboard.press('s');
  await tool(page, 'Wall').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.click(box.x + 300, box.y + 200);
  // The second point is taken back; the wall ends at the third.
  await page.keyboard.press('Backspace');
  await page.mouse.dblclick(box.x + 400, box.y + 300);
  await expect.poll(async () => (await savedWalls(page))[0]?.length).toBe(4);
  // With three points, the middle one goes when the pointer is over it and Delete is pressed.
  await tool(page, 'Wall').click();
  await page.mouse.click(box.x + 200, box.y + 400);
  await page.mouse.click(box.x + 300, box.y + 450);
  await page.mouse.dblclick(box.x + 400, box.y + 400);
  await expect.poll(async () => (await savedWalls(page)).length).toBe(2);
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 250, box.y + 425);
  await page.mouse.move(box.x + 300, box.y + 450);
  await page.keyboard.press('Delete');
  await expect
    .poll(async () => (await savedWalls(page)).map((w) => w.length).sort())
    .toEqual([4, 4]);
});

test('a road fades in and out and can close into a ring', async ({ page }) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Ends');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Road or river').click();
  await page.getByLabel('Path begins').selectOption('grow');
  await page.getByLabel('Path ends').selectOption('fade');
  await page.getByRole('checkbox', { name: 'Close the loop' }).check();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.click(box.x + 360, box.y + 220);
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"start":"grow"');
  await waitForSaved(page, 'maps', '"end":"fade"');
  await waitForSaved(page, 'maps', '"loop":true');
  // Picked, the same choices are on the road itself.
  await tool(page, 'Select and move').click();
  await page.mouse.click(box.x + 360, box.y + 220);
  await page.getByLabel('Path ends').selectOption('hard');
  await expect(page.getByLabel('Path ends')).toHaveValue('hard');
  await expect(page.getByLabel('Path begins')).toHaveValue('grow');
});

/** The brush strokes saved in the user's maps. */
const savedStrokes = (page: Page) =>
  page.evaluate(async () => {
    const out: { soft?: number; width: number; points?: number[] }[] = [];
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('user-data')).getDirectoryHandle('maps');
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        const doc = JSON.parse(await (await entry.getFile()).text()) as {
          layers?: { items: { kind: string; soft?: number; width: number; points?: number[] }[] }[];
        };
        for (const layer of doc.layers ?? [])
          for (const item of layer.items) if (item.kind === 'stroke') out.push(item);
      }
    } catch {
      return out;
    }
    return out;
  });

test('the terrain brush has a soft edge, and [ ] size it', async ({ page }) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Soft');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await tool(page, 'Terrain brush').click();
  const width = page.getByText(/^Width: \d+$/);
  const before = Number((await width.textContent())?.replace(/\D/g, ''));
  await page.keyboard.press(']');
  await expect(width).not.toHaveText(`Width: ${String(before)}`);
  await page.getByLabel('Soft edge').fill('0');
  await page.mouse.move(box.x + 150, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 220, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await savedStrokes(page)).length).toBe(1);
  await page.getByLabel('Soft edge').fill('80');
  await page.mouse.move(box.x + 150, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 320, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await savedStrokes(page)).length).toBe(2);
  expect((await savedStrokes(page)).map((x) => x.soft ?? 0).sort()).toEqual([0, 0.8]);
});

test('scatter turns its pieces within a range', async ({ page }) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Turns');
  await tool(page, 'Scatter').click();
  await page.getByLabel('Rotation of pieces').selectOption('random');
  const from = page.getByText(/^Turn from:/);
  const to = page.getByText(/^Turn to:/);
  await expect(from).toBeVisible();
  await expect(to).toContainText('360°');
  await to.getByRole('slider').fill('90');
  await expect(to).toContainText('90°');
  await page.getByLabel('Rotation of pieces').selectOption('none');
  await expect(from).toHaveCount(0);
});

test('a hole is cut out of a terrain shape and filled again', async ({ page }, testInfo) => {
  test.skip(isPhone(page), 'The Creator is drawn on the desktop.');
  await newMap(page, 'Lake');
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const click = async (x: number, y: number) => {
    await page.mouse.click(box.x + x, box.y + y);
  };
  await page.keyboard.press('s');
  await tool(page, 'Terrain shape').click();
  await click(100, 100);
  await click(500, 100);
  await click(500, 420);
  await click(100, 420);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"kind":"shape"');
  await tool(page, 'Select and move').click();
  await click(150, 150);
  await page.getByRole('button', { name: 'Cut a hole' }).click();
  await click(250, 200);
  await click(380, 200);
  await click(380, 330);
  await click(250, 330);
  await page.keyboard.press('Enter');
  await waitForSaved(page, 'maps', '"holes":[[');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: testInfo.outputPath('hole.png') });
  // The shape is picked again, and the hole can be filled.
  await page.getByRole('button', { name: 'Fill the 1 hole' }).click();
  await expect(page.getByRole('button', { name: 'Fill the 1 hole' })).toHaveCount(0);
});
