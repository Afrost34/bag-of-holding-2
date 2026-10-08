import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createCampaign, installData, newNote } from './helpers/journal';

/** Accessibility: the main pages have no serious or critical axe violations. */

async function check(page: Page, what: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = bad.map(
    (v) =>
      `${v.id} (${v.impact ?? ''}): ${v.help}\n  ${v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(' ')}: ${(n.failureSummary ?? '').replace(/\s+/g, ' ')}`)
        .join('\n  ')}`,
  );
  expect(report, `${what}:\n${report.join('\n')}`).toEqual([]);
}

test('the main pages pass axe', async ({ page }) => {
  test.setTimeout(120_000);
  await installData(page);
  await createCampaign(page, 'Lost Mine');
  const pages: [string, string][] = [
    ['./#/', 'Home'],
    ['./#/compendium', 'Compendium'],
    ['./#/compendium/list/spells', 'Spell list'],
    [`./#/compendium/${encodeURIComponent('spell:fireball@xphb')}`, 'Fireball'],
    [`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`, 'Goblin'],
    ['./#/campaigns', 'Campaigns'],
    ['./#/journal', 'Journal'],
    ['./#/characters', 'Characters'],
    ['./#/cards', 'Cards'],
    ['./#/boards', 'Boards'],
    ['./#/encounters', 'Encounters'],
    ['./#/tables', 'Tables'],
    ['./#/maps', 'Maps'],
    ['./#/settings', 'Settings'],
  ];
  for (const [url, name] of pages) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await check(page, name);
  }
});

test('editors pass axe: character, board, encounter, map, note', async ({ page }) => {
  test.setTimeout(120_000);
  await installData(page);
  await createCampaign(page, 'Lost Mine');
  const create = async (path: string, button: string, form: string) => {
    await page.goto(path);
    await page.getByRole('button', { name: button }).click();
    const f = page.getByRole('form', { name: form });
    await f.getByLabel('Name').fill('Test');
  };
  await create('./#/characters', 'New character', 'New character');
  await page
    .getByRole('form', { name: 'New character' })
    .getByRole('button', { name: 'Start building' })
    .click();
  await page.waitForTimeout(800);
  await check(page, 'Character builder');
  for (const [path, button, name] of [
    ['./#/boards', 'New board', 'Board'],
    ['./#/encounters', 'New encounter', 'Encounter'],
    ['./#/maps', 'New map', 'Map editor'],
    ['./#/tables', 'New table', 'Table'],
  ] as const) {
    await create(path, button, button);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(800);
    await check(page, name);
  }
  await page.goto('./#/journal');
  await newNote(page, 'Phandalin');
  await check(page, 'Journal note');
});

test('dark mode passes axe', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await installData(page);
  for (const [url, name] of [
    ['./#/', 'Home'],
    ['./#/compendium/list/spells', 'Spell list'],
    [`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`, 'Goblin'],
    ['./#/settings', 'Settings'],
  ] as const) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await check(page, `${name} (dark)`);
  }
});
