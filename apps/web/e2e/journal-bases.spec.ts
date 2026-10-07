import { expect, test, type Page } from '@playwright/test';
import { createCampaign, installData, showFiles, showProperties } from './helpers/journal';

/** Journal: kinds of notes (NPC, location…) and the bases that list them. Fixture data. */

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Bases');
  await page.goto('./#/journal');
});

async function newOfKind(page: Page, kind: string, name: string) {
  await showFiles(page);
  await page
    .getByRole('navigation', { name: 'Journal files' })
    .filter({ visible: true })
    .getByRole('button', { name: 'New note from template' })
    .click();
  await page.getByRole('menuitem', { name: kind, exact: true }).click();
  await page.getByLabel('Name of the new note').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue(name);
}

test('NPCs link to locations, which list them; bases are made for each kind', async ({ page }) => {
  await newOfKind(page, 'Location', 'Rustcrown');
  await newOfKind(page, 'NPC', 'Volo');
  await expect(page).toHaveURL(/note=NPCs(%2F|\/)Volo\.md/);

  // The NPC's fields are there; a typed note name becomes a link.
  await showProperties(page);
  await expect(page.getByLabel('status', { exact: true })).toHaveValue('Alive');
  const location = page.getByLabel('location', { exact: true });
  await location.fill('Rustcrown');
  await location.press('Enter');
  await expect(location).toHaveValue('[[Rustcrown]]');

  // The location lists the NPCs there.
  await page.getByRole('button', { name: 'Open Rustcrown' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Rustcrown');
  const here = page.getByRole('region', { name: 'Base: NPCs here' });
  await expect(here.getByRole('button', { name: 'Volo' })).toBeVisible();

  // A new NPC made from that list is placed there.
  await here.getByRole('button', { name: 'New note in this base' }).click();
  await page.getByLabel('Name of the new note').fill('Laeral');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Laeral');
  await showProperties(page);
  await expect(page.getByLabel('location', { exact: true })).toHaveValue('[[Rustcrown]]');

  // The NPCs base was made with the first NPC and lists both.
  await page.goto('./#/journal?note=Bases%2FNPCs.base');
  const all = page.getByRole('region', { name: 'Base: All NPCs' });
  await expect(all.getByRole('button', { name: 'Volo' })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Laeral' })).toBeVisible();
  await all.getByLabel('Search this base').fill('lae');
  await expect(all.getByRole('button', { name: 'Volo' })).toHaveCount(0);
  await all.getByLabel('Search this base').fill('');
  await all.getByRole('tab', { name: 'Cards' }).click();
  await expect(
    page.getByRole('region', { name: 'Base: Cards' }).getByRole('button', { name: 'Volo' }),
  ).toBeVisible();
});
