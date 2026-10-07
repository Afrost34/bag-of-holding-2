import { expect, test, type Page } from '@playwright/test';
import { createCampaign, installData, showFiles } from './helpers/journal';

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
  const wizard = page.getByRole('dialog', { name: `New ${kind}` });
  await wizard.getByLabel('Name', { exact: true }).fill(name);
  await wizard.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByLabel('Note title')).toHaveValue(name);
}

test('NPCs link to locations, which list them; bases are made for each kind', async ({ page }) => {
  await newOfKind(page, 'Location', 'Rustcrown');
  await newOfKind(page, 'NPC', 'Volo');
  await expect(page).toHaveURL(/note=NPCs(%2F|\/)Volo\.md/);

  // The details card shows the NPC's fields; the wizard edits them, and a name becomes a link.
  const card = page.getByRole('region', { name: 'Details' });
  await expect(card).toContainText('Alive');
  await card.getByRole('button', { name: 'Edit details' }).click();
  const wizard = page.getByRole('dialog', { name: /Edit NPC/ });
  await wizard.getByRole('button', { name: '2. Place in the world' }).click();
  await wizard.getByLabel('Location', { exact: true }).fill('Rustcrown');
  await wizard.getByRole('button', { name: 'Save', exact: true }).click();

  // The location lists the NPCs there.
  await card.getByRole('button', { name: 'Rustcrown' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Rustcrown');
  const here = page.getByRole('region', { name: 'Base: NPCs here' });
  await expect(here.getByRole('button', { name: 'Volo' })).toBeVisible();

  // A new NPC made from that list is placed there.
  await here.getByRole('button', { name: 'New note in this base' }).click();
  const newNpc = page.getByRole('dialog', { name: 'New NPC' });
  await newNpc.getByLabel('Name', { exact: true }).fill('Laeral');
  await newNpc.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Laeral');
  await expect(
    page.getByRole('region', { name: 'Details' }).getByRole('button', { name: 'Rustcrown' }),
  ).toBeVisible();

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
