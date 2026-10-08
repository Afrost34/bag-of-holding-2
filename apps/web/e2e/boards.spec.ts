import { expect, test, type Locator, type Page } from '@playwright/test';
import { installData, isPhone } from './helpers/journal';

/** DM boards: cards sent from the compendium and added on the board, moved, stacked, framed. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

const card = (page: Page, name: string) =>
  page
    .locator('.react-flow__node')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });

async function addCard(page: Page, label: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

/** Drags a card by its title bar so the bar's middle lands on `to`. */
/** Drags a card by its title bar so the bar's middle lands on `to`. */
async function dragBar(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = await from.locator('header').first().boundingBox();
  if (!box) throw new Error('no title bar');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // A small first move starts the drag (React Flow counts from there), as a hand does.
  await page.mouse.move(start.x + 4, start.y + 4, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test('a board holds compendium and board cards, stacked and framed', async ({ page }) => {
  // Send to → Board → a new board, from the spell's page.
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New board with Fireball/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Board');
  const fireball = page.getByRole('region', { name: 'Fireball', exact: true });
  await expect(fireball).toContainText('Casting Time');

  // Collapse and expand.
  await page.getByRole('button', { name: 'Collapse Fireball' }).click();
  await expect(fireball).not.toContainText('Casting Time');
  await page.getByRole('button', { name: 'Expand Fireball' }).click();
  await expect(fireball).toContainText('Casting Time');

  // A compendium entry from the board's own search, and a text card: each comes into view.
  await addCard(page, 'Compendium entry…');
  await page.getByRole('searchbox', { name: 'Find a compendium entry' }).fill('goblin');
  await page
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /Goblin/ })
    .first()
    .click();
  await page
    .getByRole('region', { name: 'Add from the compendium' })
    .getByRole('button', { name: 'Close' })
    .click();
  await expect(page.getByRole('region', { name: /Goblin/ }).first()).toBeVisible();
  await addCard(page, 'Text');
  await page.getByRole('textbox', { name: 'Text' }).fill('The innkeeper lies.');

  if (!isPhone(page)) {
    // Room above the cards, so dragging near the top does not scroll the canvas.
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(400);
    // Text's title bar onto Fireball's: a stack with two tabs.
    const target = await card(page, 'Fireball').locator('header').boundingBox();
    if (!target) throw new Error('no Fireball');
    await dragBar(page, card(page, 'Text'), {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2,
    });
    const tabs = page.getByRole('tablist', { name: 'Stacked cards' });
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await tabs.getByRole('button', { name: 'Fireball' }).click();
    await expect(page.getByRole('region', { name: 'Stack: Fireball' })).toContainText(
      'Casting Time',
    );
    // Taken out again: no stack left.
    await page.getByRole('button', { name: 'Fireball menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Take out of the stack' }).click();
    await expect(tabs).toHaveCount(0);

    // A frame; the goblin dragged into it belongs to it.
    await addCard(page, 'Frame');
    const frame = page.getByRole('region', { name: 'Frame Frame' });
    await expect(frame).toBeVisible();
    const inside = await frame.boundingBox();
    if (!inside) throw new Error('no frame');
    const goblin = page
      .locator('.react-flow__node')
      .filter({ has: page.getByRole('heading', { name: /Goblin/ }) });
    await dragBar(page, goblin, {
      x: inside.x + inside.width / 2,
      y: inside.y + inside.height / 3,
    });
    await goblin.getByRole('button', { name: /menu$/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Take out of the frame' })).toBeVisible();
    await page.keyboard.press('Escape');
  }

  // Kept after a reload.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('The innkeeper lies.');

  // Listed with the other boards; deleted from the board.
  await page.getByRole('button', { name: 'Delete board' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible();
  await expect(page.getByText('No boards yet.')).toBeVisible();
});

test('a card shown to players opens in the player window', async ({ page, context }) => {
  test.skip(isPhone(page), 'The player window is for a second screen.');
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New board with Fireball/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await page.getByRole('button', { name: 'Fireball menu', exact: true }).click();
  const [player] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('menuitem', { name: 'Show to players' }).click(),
  ]);
  // The players see a board of the shown cards (here one), not the app.
  await expect(player.getByRole('region', { name: 'Fireball' })).toBeVisible();
  await expect(player.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByLabel('Shown to players')).toBeVisible();
  // The player window never takes the data: the DM's window, reloaded, still has it.
  const board = page.url();
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Fireball' })).toBeVisible();
  await expect(page.getByText('open in another tab or window')).toHaveCount(0);
  await page.goto(board);
  // Hidden again: gone from their window.
  await page.getByRole('button', { name: 'Fireball menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Hide from players' }).click();
  await expect(player.getByRole('region', { name: 'Fireball' })).toHaveCount(0);
});

test('right-click adds where clicked; the NPC generator; frames rename', async ({ page }) => {
  test.skip(isPhone(page), 'Right-click is a desktop gesture.');
  await page.goto('./#/boards');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Session 1');
  await page.getByRole('button', { name: 'Create' }).click();
  const canvas = page
    .getByRole('application', { name: 'Board canvas' })
    .or(page.locator('.react-flow'))
    .first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  // Right-click: the Add menu where the pointer is.
  await page.mouse.click(box.x + 200, box.y + 200, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Add here' });
  await menu.getByRole('menuitem', { name: 'NPC generator' }).click();
  await expect(menu).toHaveCount(0);
  const npc = page.locator('.react-flow__node').filter({ hasText: 'Secret' });
  await expect(npc).toBeVisible();
  const before = await npc.getByRole('heading').first().textContent();
  await npc.getByRole('button', { name: 'Another' }).click();
  await expect(npc.getByRole('heading').first()).not.toHaveText(before ?? '');
  // A picked card goes with the Delete key.
  const bar = await npc.locator('.card-drag').first().boundingBox();
  if (!bar) throw new Error('no NPC card');
  await page.mouse.click(bar.x + 12, bar.y + bar.height / 2);
  await page.keyboard.press('Delete');
  await expect(npc).toHaveCount(0);
  // A search panel asked for by right-click opens where the pointer was.
  await page.mouse.click(box.x + 150, box.y + 120, { button: 'right' });
  await page
    .getByRole('menu', { name: 'Add here' })
    .getByRole('menuitem', { name: 'Compendium entry…' })
    .click();
  const panel = await page.getByRole('region', { name: 'Add from the compendium' }).boundingBox();
  expect(Math.abs((panel?.x ?? 0) - (box.x + 150))).toBeLessThan(20);
  expect(Math.abs((panel?.y ?? 0) - (box.y + 120))).toBeLessThan(20);
  await page
    .getByRole('region', { name: 'Add from the compendium' })
    .getByRole('button', { name: 'Close' })
    .click();
  // A frame, renamed without dragging its title around.
  await page.mouse.click(box.x + box.width - 80, box.y + 40, { button: 'right' });
  await page
    .getByRole('menu', { name: 'Add here' })
    .getByRole('menuitem', { name: 'Frame' })
    .click();
  await page.getByRole('button', { name: 'Rename frame Frame' }).click();
  await page.getByRole('textbox', { name: 'Frame title' }).fill('Town');
  await page.getByRole('textbox', { name: 'Frame title' }).press('Enter');
  await expect(page.getByRole('region', { name: 'Frame Town' })).toBeVisible();
  // The empty-board hint and the minimap are gone.
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0);
});

test('a board of 300 cards pans and zooms smoothly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Measured once, on the desktop.');
  // 300 cards written straight to storage: compendium entries, text, dice, initiative.
  const keys = ['spell:fireball@xphb', 'spell:magic missile@xphb', 'spell:shield@xphb'];
  await page.evaluate(async (entityKeys) => {
    const cards = Array.from({ length: 300 }, (_, i) => {
      const at = {
        id: `c${String(i)}`,
        x: (i % 20) * 380,
        y: Math.floor(i / 20) * 420,
        w: 340,
        h: 380,
      };
      if (i % 3 === 0) return { ...at, kind: 'entity', key: entityKeys[i % entityKeys.length] };
      if (i % 3 === 1) return { ...at, kind: 'text', text: `Note ${String(i)}` };
      return { ...at, kind: 'dice', formulas: ['1d20+5'] };
    });
    const board = { version: 1, name: 'Big board', createdAt: '', updatedAt: '', cards };
    const root = await navigator.storage.getDirectory();
    const dir = await (
      await root.getDirectoryHandle('user-data', { create: true })
    ).getDirectoryHandle('boards', { create: true });
    const file = await dir.getFileHandle('big.json', { create: true });
    const w = await file.createWritable();
    await w.write(JSON.stringify(board));
    await w.close();
  }, keys);
  await page.goto('./#/boards/big');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Big board');
  await expect(page.locator('.react-flow__node').first()).toBeVisible();

  // Frame times while zooming out over the whole board and back in, and panning.
  const canvas = await page.locator('.react-flow').boundingBox();
  if (!canvas) throw new Error('no canvas');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
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
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 120);
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -120);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 50, canvas.y + 50, { steps: 30 });
  await page.mouse.up();
  const frames = await page.evaluate(() =>
    (window as unknown as { __frames: number[] }).__frames.slice(1).sort((a, b) => a - b),
  );
  const p90 = frames[Math.floor(frames.length * 0.9)] ?? 0;
  const median = frames[Math.floor(frames.length / 2)] ?? 0;
  testInfo.annotations.push({
    type: 'frames',
    description: `${String(frames.length)} frames, median ${median.toFixed(1)} ms, p90 ${p90.toFixed(1)} ms`,
  });
  // Smooth: most frames well under 1/20 s even on a CI machine.
  expect(median).toBeLessThan(34);
  expect(p90).toBeLessThan(80);
});
