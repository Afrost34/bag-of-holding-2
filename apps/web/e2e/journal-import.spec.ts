import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createCampaign, editor, installData, showFiles } from './helpers/journal';

/** Journal: one-time import of an Obsidian vault (a small vault made on disk). */

let vault: string;

test.beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), 'boh-vault-'));
  vault = join(root, 'Rust & Sunfire');
  const write = (path: string, text: string) => {
    const full = join(vault, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  write('.obsidian/app.json', '{}');
  write('.trash/Old.md', 'old');
  write('R/00_Index.md', '# Index\nSee [[Rustcrown]] and [[R/05_NPCs/Mother_Tibia|Tibia]].\n');
  // A byte-order mark before the properties, as some of the real notes have.
  write(
    'R/05_NPCs/Mother_Tibia.md',
    String.fromCharCode(0xfeff) +
      '---\ntype: npc\nlocation: "[[Rustcrown]]"\n---\nCasts [[App:Spell:Shield|Shield]]. Knows [[../04_Factions/Red_Fangs]] and [[Gone]].\n',
  );
  write('R/03_Locations/Rustcrown.md', '---\ntype: location\n---\nThe rusted city.\n');
  write('R/04_Factions/Red_Fangs.md', 'Pirates.\n');
  write(
    'R/99_DB/NPCs.base',
    'views:\n  - type: table\n    name: All NPCs\n    filters:\n      and:\n        - type == "npc"\n',
  );
  write('R/tools/build.py', 'print(1)');
});

test.afterAll(() => {
  rmSync(join(vault, '..'), { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Imported');
  await page.goto('./#/journal');
});

test('an Obsidian vault imports with its links working', async ({ page }) => {
  await page.getByRole('button', { name: 'Import your vault' }).click();
  const panel = page.getByRole('region', { name: 'Import from Obsidian' });
  await panel.getByLabel('Vault folder').setInputFiles(vault);
  await expect(panel.getByText('Notes', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Import 5 files' }).click();
  await expect(panel.getByText('Imported 5 files.')).toBeVisible();
  // Only the link to a note that does not exist is reported.
  await expect(
    panel.getByText('4 of 5 links lead to a note or file', { exact: false }),
  ).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Links that lead nowhere' })).toContainText('Gone');

  await panel.getByRole('button', { name: 'Mother Tibia' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Mother_Tibia');
  // Relative links resolve, and the old app's spell link became a compendium link.
  await expect(
    editor(page).locator('.cm-jlink:not(.cm-jlink-missing):not(.cm-jlink-compendium)'),
  ).toHaveText('../04_Factions/Red_Fangs');
  await expect(editor(page).locator('.cm-jlink-compendium')).toHaveText('Shield');
  await expect(editor(page).locator('.cm-jlink-missing')).toHaveText('Gone');

  // The vault's base lists the NPC.
  await page.goto('./#/journal?note=R%2F99_DB%2FNPCs.base');
  await expect(
    page
      .getByRole('region', { name: 'Base: All NPCs' })
      .getByRole('button', { name: 'Mother Tibia' }),
  ).toBeVisible();
  await showFiles(page);
  await expect(
    page.getByRole('navigation', { name: 'Journal files' }).filter({ visible: true }),
  ).not.toContainText('.obsidian');
});
