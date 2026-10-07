import { expect, test, type Page } from '@playwright/test';
import { createCampaign, editor, installData, newNote, showFiles } from './helpers/journal';

/** Journal notes: properties, tags, templates and embeds. Fixture data. */

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Notes');
  await page.goto('./#/journal');
});

/** Leaves the editor, so the whole note shows formatted. */
async function leaveEditor(page: Page) {
  await page.getByLabel('Note title').click();
}

test('properties are edited in a panel instead of as YAML', async ({ page }) => {
  await newNote(page, 'Mother Tibia');
  await page.getByRole('button', { name: 'Add property' }).click();
  await page.getByLabel('New property name').fill('type');
  await page.getByLabel('New property name').press('Enter');
  const value = page.getByRole('textbox', { name: 'type', exact: true });
  await value.fill('npc');
  await value.press('Enter');
  await expect(value).toHaveValue('npc');
  // The YAML is hidden in the editor, and shown again on request.
  await expect(editor(page)).not.toContainText('type: npc');
  await page.getByRole('button', { name: 'Properties as text' }).click();
  await expect(editor(page)).toContainText('type: npc');

  // Survives a reload (notes are saved shortly after each change).
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'type', exact: true })).toHaveValue('npc');
});

test('tags in notes are listed in the Tags pane', async ({ page }) => {
  await newNote(page, 'Volo');
  await editor(page).click();
  await page.keyboard.type('A gossip. #npc #faction/harpers');
  await leaveEditor(page);
  await editor(page).getByText('#npc').click();
  const tags = page.getByRole('list', { name: 'Tags' }).filter({ visible: true });
  await expect(tags.getByRole('button', { name: /npc/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(tags.getByRole('button', { name: 'Volo' })).toBeVisible();
  await expect(tags.getByRole('button', { name: /faction/ })).toBeVisible();
});

test('a note can start from a template', async ({ page }) => {
  // A note in a "Templates" folder is a template.
  await showFiles(page);
  const files = page.getByRole('navigation', { name: 'Journal files' }).filter({ visible: true });
  await files.getByRole('button', { name: 'New folder' }).click();
  await files.getByRole('button', { name: 'Actions for New folder' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('New name for New folder').fill('Templates');
  await page.getByLabel('New name for New folder').press('Enter');
  await files.getByRole('button', { name: 'Actions for Templates' }).click();
  await page.getByRole('menuitem', { name: 'New note here' }).click();
  const title = page.getByLabel('Note title');
  await title.fill('NPC');
  await title.press('Enter');
  await expect(page).toHaveURL(/note=Templates(%2F|\/)NPC\.md/);
  await editor(page).click();
  await page.keyboard.type('Name: {{title}}');
  await leaveEditor(page);

  await showFiles(page);
  await files.getByRole('button', { name: 'New note from template' }).click();
  await page.getByRole('menuitem', { name: 'NPC' }).click();
  await page.getByLabel('Name of the new note').fill('Laeral');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Laeral');
  await expect(editor(page)).toContainText('Name: Laeral');
});

test('notes, compendium entries and pasted images are embedded', async ({ page }) => {
  await newNote(page, 'Waterdeep');
  await editor(page).click();
  await page.keyboard.type('The City of Splendors.');
  await newNote(page, 'Session 1');
  await editor(page).click();
  await page.keyboard.type('![[Water');
  await page.getByRole('option', { name: /^Waterdeep/ }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('![[spell:magic mi');
  await page
    .getByRole('option', { name: /^Magic Missile/ })
    .first()
    .click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  // Paste an image: it is saved with the journal and embedded.
  await editor(page).evaluate(async (el) => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) throw new Error('no image');
    const data = new DataTransfer();
    data.items.add(new File([blob], 'map.png', { type: 'image/png' }));
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await leaveEditor(page);

  await expect(editor(page)).toContainText('The City of Splendors.');
  await expect(editor(page).getByRole('heading', { name: 'Magic Missile' })).toBeVisible();
  await expect(editor(page).getByRole('img', { name: 'map' })).toBeVisible();
  await showFiles(page);
  await expect(
    page
      .getByRole('navigation', { name: 'Journal files' })
      .filter({ visible: true })
      .getByRole('treeitem', { name: '_assets' }),
  ).toBeVisible();
});
