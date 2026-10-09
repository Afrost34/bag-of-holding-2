import { expect, test } from '@playwright/test';
import { GLUBS } from '../../../packages/rules/src/glubs.fixture';
import { hasRealData, installRealData, putCharacter } from './helpers/realData';

/**
 * With the real 5etools release: what the small fixture cannot show (spells, every class
 * feature, item templates, Wild Shape forms). Skipped when the data is not downloaded
 * (`pnpm data:fetch`); CI downloads it.
 */

test.skip(!hasRealData(), 'Needs the 5etools data: pnpm data:fetch');

test('real characters build, print and pick Wild Shape forms', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Once is enough: the data install is long.');
  test.setTimeout(360_000);
  await installRealData(page);

  await test.step('Glubs (a level 3 Bard) has the sheet of the owner’s PDF', async () => {
    await putCharacter(page, {
      id: 'glubs',
      name: 'Glubs',
      decisions: {
        ...GLUBS,
        inventory: [
          ...(GLUBS.inventory ?? []),
          { key: 'item:ring of necrotic resistance@xdmg', quantity: 1 },
        ],
      },
    });
    await page.goto('./#/characters/glubs?step=sheet');
    await page.reload();
    const sheet = page.getByRole('main');
    await expect(sheet.getByText('Armor Class', { exact: true })).toBeVisible({ timeout: 60_000 });
    const attacks = sheet.getByRole('region', { name: 'Attacks' });
    await expect(attacks).toContainText('Mind Sliver');
    await expect(attacks).toContainText('60 feet');
  });

  await test.step('its printed cards: uses to tick, masteries, item texts written out', async () => {
    await page.goto('./#/characters/glubs/print');
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled({
      timeout: 60_000,
    });
    const paper = page.locator('main .paper');
    const bardic = paper
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Bardic Inspiration', exact: true }) })
      .first();
    await expect(bardic.getByLabel('4 uses')).toBeVisible({ timeout: 30_000 });
    await expect(paper.getByText('Mastery: Slow').first()).toBeVisible();
    const ring = paper
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Ring of Necrotic Resistance' }) })
      .first();
    await expect(ring).toContainText('necrotic damage');
    await expect(ring).not.toContainText('{#itemEntry');
  });

  await test.step('a Moon Druid’s Wild Shape follows Circle Forms', async () => {
    await putCharacter(page, {
      id: 'moon',
      name: 'Rynn',
      decisions: {
        schema: 1,
        edition: '2024',
        baseScores: { str: 8, dex: 14, con: 14, int: 10, wis: 16, cha: 10 },
        species: 'race:elf@xphb',
        classes: [{ class: 'class:druid@xphb', levels: 6 }],
        choices: { 'class:druid@xphb/level:3/subclass': ['subclass:moon|druid|xphb@xphb'] },
        inventory: [],
      },
    });
    await page.goto('./#/characters/moon?step=sheet');
    await page.reload();
    const wild = page.getByRole('region', { name: 'Wild Shape' });
    await expect(wild).toContainText('Forms known: 0/6', { timeout: 60_000 });
    await expect(wild).toContainText('CR up to 2');
    await expect(wild).toContainText('Circle Forms');
  });
});
