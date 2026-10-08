import { expect, test } from '@playwright/test';
import { createCampaign, installData, showFiles } from './helpers/journal';

/** The campaign's own kinds of notes, listed in the compendium; the journal reopens the last note. */

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Sea of Swords');
  await page.goto('./#/journal');
});

test('a kind of the DM’s own: made, used, and listed in the compendium', async ({ page }) => {
  const menu = async () => {
    await showFiles(page);
    await page
      .getByRole('navigation', { name: 'Journal files' })
      .filter({ visible: true })
      .getByRole('button', { name: 'New note from template' })
      .click();
  };
  // A new kind: Ships, with a captain and a crew.
  await menu();
  await page.getByRole('menuitem', { name: 'New kind of note…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Kinds of notes' });
  await dialog.getByRole('button', { name: 'New kind' }).click();
  await dialog.getByLabel('Name (one)').fill('Ship');
  await dialog.getByRole('button', { name: 'Icon ship' }).click();
  await dialog.getByRole('button', { name: 'Add a property' }).click();
  await dialog.getByLabel('Property 1 name').fill('Captain');
  await dialog.getByRole('button', { name: 'Add a property' }).click();
  await dialog.getByLabel('Property 2 name').fill('Crew');
  await dialog.getByLabel('Property 2 kind').selectOption('number');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('list', { name: 'Your kinds' })).toContainText('Ships');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A ship, through the same wizard as an NPC.
  await menu();
  await page.getByRole('menuitem', { name: 'Ship', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'New Ship' });
  await wizard.getByLabel('Name', { exact: true }).fill('Sea Hag');
  await wizard.getByLabel('Crew', { exact: true }).fill('40');
  await wizard.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/note=Ships(%2F|\/)Sea%20Hag\.md/);

  // The compendium lists the campaign's ships like its spells.
  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Sea of Swords' })
    .getByRole('link', { name: /Ships/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ships' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Ships list' });
  await expect(list).toContainText('Sea Hag');
  await expect(list).toContainText('40');
  await list.getByRole('button', { name: /Sea Hag/ }).click();
  await expect(page.getByRole('link', { name: 'Open in the journal' })).toBeVisible();

  // The journal opens again on the last note.
  await page.goto('./#/journal');
  await expect(page).toHaveURL(/note=Ships(%2F|\/)Sea%20Hag\.md/);
});
