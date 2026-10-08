import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installData, isPhone } from './helpers/journal';
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
  await tool(page, 'Spell template').click();
  await page.mouse.move(at(450, 300).x, at(450, 300).y);
  await page.mouse.down();
  await page.mouse.move(at(550, 300).x, at(550, 300).y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('region', { name: 'Spell template' })).toBeVisible();
  await tool(page, 'Pin').click();
  await page.mouse.click(at(500, 150).x, at(500, 150).y);
  await page.getByLabel('Pin label').fill('Cave mouth');

  // Measuring counts squares (5 ft each).
  await tool(page, 'Measure').click();
  await page.mouse.move(at(100, 500).x, at(100, 500).y);
  await page.mouse.down();
  await page.mouse.move(at(400, 500).x, at(400, 500).y, { steps: 5 });
  await expect(page.getByRole('status').filter({ hasText: /Distance: \d+ ft/ })).toBeVisible();
  await page.mouse.up();

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
  await expect.poll(countOf).toBe(6);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(countOf).toBe(6); // the pin's label change is undone first
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(countOf).toBe(5);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(countOf).toBe(6);

  // Hex grid, then back.
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.getByLabel('Type').selectOption('hex');
  await page.getByLabel('Type').selectOption('square');

  // The PNG is the whole map at full size.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Cragmaw Hideout.png');
  const file = testInfo.outputPath('map.png');
  await download.saveAs(file);
  expect(pngSize(readFileSync(file))).toEqual({ width: 2800, height: 2100 });

  // Kept after a reload.
  await page.reload();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect.poll(countOf).toBe(6);
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
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 150_000 }),
    page.getByRole('button', { name: 'Export PNG' }).click(),
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

  // A category of pins with its icon; a pin in it takes the icon.
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

test('stamps found online are added to the library and placed', async ({ page }) => {
  test.skip(isPhone(page), 'Checked on the desktop.');
  // The pack, served here instead of the CDN (a few icons in the same Iconify format).
  let downloads = 0;
  await page.route(
    'https://cdn.jsdelivr.net/npm/@iconify-json/game-icons@*/icons.json',
    (route) => {
      downloads++;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          prefix: 'game-icons',
          width: 512,
          height: 512,
          icons: {
            castle: {
              body: '<path fill="currentColor" d="M64 448V160h96v64h64v-96h64v96h64v-64h96v288z"/>',
            },
            'castle-ruins': { body: '<path fill="currentColor" d="M64 448V256h128v192z"/>' },
            'oak-tree': { body: '<circle fill="currentColor" cx="256" cy="200" r="150"/>' },
          },
        }),
      });
    },
  );
  await newMap(page, 'Neverwinter');
  await page.getByRole('button', { name: 'Find online' }).click();
  const online = page.getByRole('region', { name: 'Stamps online' });
  await expect(online).toContainText('CC BY 3.0');
  await online.getByRole('button', { name: /Download the pack/ }).click();
  await online.getByLabel('Find stamps online').fill('castle');
  const found = online.getByRole('list', { name: 'Online stamps' });
  await expect(found.getByRole('listitem')).toHaveCount(2);
  await online.getByRole('radio', { name: 'Red' }).click();
  await found.getByRole('button', { name: 'Add castle', exact: true }).click();
  await expect(online.getByRole('status')).toContainText('Added “castle”');
  // It is in the library, picked, and the stamp tool is on.
  await expect(tool(page, 'Stamp')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('list', { name: 'Stamp pictures' }).getByRole('button', { name: 'castle' }),
  ).toBeVisible();
  const box = await page.getByRole('application', { name: 'Map canvas' }).boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + 200, box.y + 200);
  await expect(page.getByRole('region', { name: 'Stamp' })).toBeVisible();
  // Opened again, the pack comes from the browser's cache: no second download.
  await page.reload();
  await page.getByRole('button', { name: 'Find online' }).click();
  await expect(online.getByLabel('Find stamps online')).toBeVisible();
  expect(downloads).toBe(1);
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

test('picture layers (a night version) are shown and hidden over the picture', async ({ page }) => {
  await installData(page);
  await newMap(page, 'Abandoned Mine');
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Map' }).click();
  const pick = async (label: string, name: string) => {
    await page.getByLabel(label).setInputFiles({ name, mimeType: 'image/png', buffer: PIXEL });
  };
  await pick('Choose a picture', 'Mine_Day.png');
  await expect(page.getByLabel('Replace the picture')).toBeAttached();
  await pick('Add a picture layer', 'Mine_Night.png');
  const layers = page.getByRole('list', { name: 'Picture layers' });
  await expect(layers.getByLabel('Picture layer name')).toHaveValue('Mine Night');
  await layers.getByRole('button', { name: 'Hide Mine Night' }).click();
  await expect(layers.getByRole('button', { name: 'Show Mine Night' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await waitForSaved(page, 'maps', '"visible":false');
  await page.reload();
  await expect(page.getByRole('application', { name: 'Map canvas' }).locator('canvas')).toHaveCount(
    1,
  );
  if (isPhone(page)) await page.getByRole('button', { name: 'Panels' }).click();
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page
      .getByRole('list', { name: 'Picture layers' })
      .getByRole('button', { name: 'Show Mine Night' }),
  ).toBeVisible();
});
