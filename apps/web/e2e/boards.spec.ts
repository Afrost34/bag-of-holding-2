import { expect, test, type Locator, type Page } from '@playwright/test';
import { createCampaign, installData, isPhone } from './helpers/journal';
import { waitForSaved } from './helpers/saved';

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
  await waitForSaved(page, 'boards', 'The innkeeper lies.');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('The innkeeper lies.');

  // Listed with the other boards; deleted from the board.
  await page.getByRole('button', { name: 'Delete board' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible();
  await expect(page.getByText('No boards yet.')).toBeVisible();
});

test('the player window is a board of its own, that cards are sent to', async ({
  page,
  context,
}) => {
  test.skip(isPhone(page), 'The player window is for a second screen.');
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New board with Fireball/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await page.getByRole('button', { name: 'Fireball menu', exact: true }).click();
  const [player] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('menuitem', { name: 'Send to players' }).click(),
  ]);
  // A copy on the players' board, with its text read through the DM's window, and no app around.
  const fireball = player.getByRole('region', { name: 'Fireball', exact: true });
  await expect(fireball).toContainText('Casting Time');
  await expect(player.getByRole('navigation')).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Delete board' })).toHaveCount(0);

  // It is a board: cards are added and removed there.
  await player.getByRole('button', { name: 'Add', exact: true }).click();
  await player.getByRole('menuitem', { name: 'Text' }).click();
  await player.getByRole('textbox', { name: 'Text' }).fill('Welcome to Rustcrown');
  await fireball.locator('.card-drag').first().click();
  await player.keyboard.press('Delete');
  await expect(fireball).toHaveCount(0);

  // Sent again while it is open: it arrives there, beside what is on the board.
  await page.bringToFront();
  await page.getByRole('button', { name: 'Fireball menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Send to players' }).click();
  await expect(fireball).toBeVisible();
  await expect(player.getByRole('textbox', { name: 'Text' })).toHaveValue('Welcome to Rustcrown');

  // The player window never takes the data: the DM's window, reloaded, still has it.
  await page.goto(`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Fireball' })).toBeVisible();
  await expect(page.getByText('open in another tab or window')).toHaveCount(0);
  // The players' board is not one of the DM's boards.
  await page.goto('./#/boards?list=1');
  await expect(page.getByRole('link', { name: /Players/ })).toHaveCount(0);
});

test('right-click adds where clicked; the NPC generator; frames rename', async ({ page }) => {
  test.skip(isPhone(page), 'Right-click is a desktop gesture.');
  await page.goto('./#/boards?list=1');
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

test('a link in a card brings its entry onto the board; Ctrl+click opens it', async ({ page }) => {
  await page.goto(`./#/compendium/${encodeURIComponent('table:wild surge@phb')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New board with Wild Surge/ }).click();
  await page.getByRole('status').getByRole('link').click();
  const surge = page.getByRole('region', { name: 'Wild Surge', exact: true });
  await surge.getByRole('link', { name: 'Magic Missile' }).click();
  await expect(page.getByRole('region', { name: 'Magic Missile', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/boards\//);
  if (isPhone(page)) return;
  await surge.getByRole('link', { name: 'Magic Missile' }).click({ modifiers: ['Control'] });
  await expect(page.getByRole('tab', { selected: true }).first()).toHaveText(/Magic Missile/);
});

test('a character card is the first page of its sheet, with its sections as tabs', async ({
  page,
}) => {
  await page.goto('./#/characters');
  await page.getByRole('button', { name: 'New character' }).click();
  const form = page.getByRole('form', { name: 'New character' });
  await form.getByLabel('Name').fill('Lia');
  await form.getByRole('button', { name: 'Start building' }).click();
  await expect(page).toHaveURL(/characters\/[a-z0-9]+/);
  await page.goto('./#/boards?list=1');
  await page.reload();
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Party');
  await page.getByRole('button', { name: 'Create' }).click();
  await addCard(page, 'Character…');
  await page.getByRole('list', { name: 'Characters' }).getByRole('button', { name: /Lia/ }).click();
  const sheet = page.locator('.react-flow__node').filter({ hasText: 'Lia' });
  await expect(sheet.getByRole('region', { name: 'Skills' })).toContainText('Stealth');
  // The side works like tabs: one section alone, or the sheet.
  const story = sheet.getByRole('tab', { name: 'Story' });
  await expect(story).toHaveAttribute('aria-selected', 'false');
  await story.click();
  await expect(story).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByRole('region', { name: 'Story' })).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'Skills' })).toHaveCount(0);
  await sheet.getByRole('tab', { name: 'Sheet' }).click();
  await expect(sheet.getByRole('region', { name: 'Skills' })).toBeVisible();
  // Passive scores under the abilities; proficiencies in a tab of their own.
  await expect(sheet.getByLabel('Passive scores')).toContainText('Investigation');
  await expect(sheet.getByRole('region', { name: 'Proficiencies' })).toHaveCount(0);
  await sheet.getByRole('tab', { name: 'Proficiencies' }).click();
  await expect(sheet.getByRole('region', { name: 'Proficiencies' })).toContainText('Languages');
});

test('a card fills the whole screen, and a map in it still pans and zooms', async ({ page }) => {
  await page.goto('./#/maps');
  await page.getByRole('button', { name: 'New map' }).click();
  await page.getByRole('form', { name: 'New map' }).getByLabel('Name').fill('Sunash Sea');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Map name' })).toHaveValue('Sunash Sea');
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Session 1');
  await page.getByRole('button', { name: 'Create' }).click();
  await addCard(page, 'Map…');
  await page
    .getByRole('list', { name: 'Maps' })
    .getByRole('button', { name: 'Sunash Sea' })
    .click();
  const map = card(page, 'Sunash Sea');
  await expect(map.getByRole('img', { name: 'Map: Sunash Sea' })).toBeVisible();

  await map.getByRole('button', { name: 'Full screen Sunash Sea' }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('aria-label')))
    .toBe('Sunash Sea');
  const view = page.viewportSize();
  const shown = await page.getByRole('img', { name: 'Map: Sunash Sea' }).boundingBox();
  expect(shown?.width).toBeGreaterThan((view?.width ?? 0) - 20);
  expect(shown?.height).toBeGreaterThan((view?.height ?? 0) - 100);
  // Zooming the map keeps it filling the screen.
  await page.mouse.move((view?.width ?? 0) / 2, (view?.height ?? 0) / 2);
  await page.mouse.wheel(0, -400);
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('aria-label')))
    .toBe('Sunash Sea');
  expect((await page.getByRole('img', { name: 'Map: Sunash Sea' }).boundingBox())?.width).toBe(
    shown?.width,
  );
  await page.getByRole('button', { name: 'Leave full screen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(map.getByRole('button', { name: 'Full screen Sunash Sea' })).toBeVisible();
});

test('board changes are undone and redone, with the buttons or the keyboard', async ({ page }) => {
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Session 1');
  await page.getByRole('button', { name: 'Create' }).click();
  const nodes = page.locator('.react-flow__node');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await addCard(page, 'NPC generator');
  await addCard(page, 'Timer');
  await expect(nodes).toHaveCount(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(nodes).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(nodes).toHaveCount(2);
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(nodes).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+y');
  await expect(nodes).toHaveCount(1);
});

test('Boards reopens the last board; the title switches boards and makes new ones', async ({
  page,
}) => {
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByLabel('Name').fill('Prep');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Prep');
  await page.getByRole('button', { name: 'Switch board' }).click();
  await page.getByRole('menuitem', { name: 'New board' }).click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('New board');
  // Boards comes back to the board open last.
  await page.goto('./#/boards');
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('New board');
  await page.getByRole('button', { name: 'Switch board' }).click();
  await page.getByRole('menuitem', { name: 'Prep' }).click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Prep');
  await page.getByRole('button', { name: 'Switch board' }).click();
  await page.getByRole('menuitem', { name: 'All boards' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible();
});

test('note cards format the whole note, change note in place, and copy with Ctrl+D', async ({
  page,
}) => {
  await createCampaign(page, 'Rust and Sunfire');
  // Two notes written straight to the journal: a long one (formatting must reach its end).
  const long = Array.from(
    { length: 60 },
    (_, i) => `- **Point ${String(i + 1)}:** something to remember`,
  ).join('\n');
  await page.evaluate(
    async (notes) => {
      let dir = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle('user-data', {
        create: true,
      });
      for (const part of ['campaigns', 'rust-and-sunfire', 'journal'])
        dir = await dir.getDirectoryHandle(part, { create: true });
      for (const [name, text] of notes) {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(text);
        await w.close();
      }
    },
    [
      ['Plans.md', `---\nstatus: draft\n---\n# Plans\n\n${long}\n\n## The end\n\n**Last words.**`],
      ['Short.md', 'A short note.'],
    ] as [string, string][],
  );
  await page.goto('./#/boards?list=1');
  await page.reload();
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await addCard(page, 'Note…');
  await page.getByRole('searchbox', { name: 'Find a note' }).fill('plans');
  await page.getByRole('list', { name: 'Notes' }).getByRole('button', { name: /Plans/ }).click();
  const plans = card(page, 'Plans');
  // Scrolled down, the rest comes in formatted to the last line; no properties.
  const body = plans.locator('.overflow-auto').first();
  for (let i = 0; i < 8; i++) {
    await body.evaluate((el) => {
      el.scrollTop += 400;
    });
    await page.waitForTimeout(100);
    await expect(plans).not.toContainText('**');
  }
  await expect(plans).toContainText('Last words.');
  await expect(plans).not.toContainText('**');
  await expect(plans).not.toContainText('status');

  // Ctrl+D copies the selected card.
  await plans.locator('header').first().click();
  await page.keyboard.press('Control+d');
  await expect(card(page, 'Plans')).toHaveCount(2);

  // Another note in its place.
  // (The copy lies on top of the original.)
  await card(page, 'Plans').last().getByRole('button', { name: 'Change note' }).click();
  await card(page, 'Plans')
    .last()
    .getByRole('list', { name: 'Notes' })
    .getByRole('button', { name: /Short/ })
    .click();
  await expect(card(page, 'Short')).toContainText('A short note.');
  await expect(card(page, 'Plans')).toHaveCount(1);
});

test('the wheel zooms the board over a card that fits, and scrolls one that does not', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A mouse wheel.');
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await addCard(page, 'Text');
  const body = page.locator('.react-flow__node').last().locator('.nodrag').last();
  const box = await body.boundingBox();
  if (!box) throw new Error('no card');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.getAttribute('style');
  await page.mouse.wheel(0, -300);
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(before);
  // More lines than fit: the wheel scrolls the text, the board stays as it is.
  await page
    .getByRole('textbox', { name: 'Text' })
    .fill(Array.from({ length: 60 }, (_, i) => `Line ${String(i)}`).join('\n'));
  const after = await body.boundingBox();
  if (!after) throw new Error('no card');
  await page.mouse.move(after.x + after.width / 2, after.y + after.height / 2);
  const still = await viewport.getAttribute('style');
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  expect(await viewport.getAttribute('style')).toBe(still);
});

test('a unit converter card turns feet into metres and squares, and back', async ({ page }) => {
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await addCard(page, 'Unit converter');
  const out = page.getByLabel('Converted');
  await expect(out).toContainText('Squares6');
  await expect(out).toContainText('Metres9');
  await page.getByLabel('Unit', { exact: true }).selectOption('m');
  await page.getByLabel('Distance', { exact: true }).fill('4.5');
  await expect(out).toContainText('Squares3');
  await expect(out).toContainText('Feet15');
});

test('selected cards line up and space out; moves can snap to the grid', async ({ page }) => {
  await page.goto('./#/boards?list=1');
  await page.getByRole('button', { name: 'New board' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  for (const kind of ['Text', 'Timer', 'Dice']) await addCard(page, kind);
  const cards = ['Text', 'Timer', 'Dice'].map((name) => card(page, name));
  const bar = page.getByRole('toolbar', { name: 'Align cards' });
  await expect(bar).toHaveCount(0);
  await cards[0]?.locator('header').first().click();
  for (const c of cards.slice(1))
    await c
      .locator('header')
      .first()
      .click({ modifiers: ['ControlOrMeta'] });
  await expect(bar).toContainText('3 cards');
  await bar.getByRole('button', { name: 'Align top edges' }).click();
  await expect(async () => {
    const tops = await Promise.all(cards.map(async (c) => (await c.boundingBox())?.y));
    expect(new Set(tops).size).toBe(1);
  }).toPass();

  const snap = page.getByRole('button', { name: 'Snap to grid' });
  await expect(snap).toHaveAttribute('aria-pressed', 'false');
  await snap.click();
  await expect(snap).toHaveAttribute('aria-pressed', 'true');
});
