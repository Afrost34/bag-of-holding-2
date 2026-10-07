import { expect, test, type Page } from '@playwright/test';
import {
  createCampaign,
  editor,
  installData,
  newNote,
  showFiles,
  showProperties,
} from './helpers/journal';

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

test('details are filled in with a form and shown as a card, never as YAML', async ({ page }) => {
  await newNote(page, 'The Old Mill');
  await page.getByRole('button', { name: 'Add details' }).click();
  const wizard = page.getByRole('dialog', { name: /Edit note/ });
  await wizard.getByLabel('Another detail').fill('Mood');
  await wizard.getByRole('button', { name: 'Add', exact: true }).click();
  await wizard.getByLabel('Mood', { exact: true }).fill('Grim');
  await wizard.getByRole('button', { name: 'Save', exact: true }).click();
  const card = page.getByRole('region', { name: 'Details' });
  await expect(card).toContainText('Mood');
  await expect(card).toContainText('Grim');
  await expect(editor(page)).not.toContainText('mood:');

  // The Markdown, properties included, is there in code mode.
  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(editor(page)).toContainText('mood: Grim');
  await showProperties(page);
  await expect(page.getByLabel('mood', { exact: true })).toHaveValue('Grim');
  await page.getByRole('button', { name: 'Markdown' }).click();

  // Survives a reload (notes are saved shortly after each change).
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Details' })).toContainText('Grim');
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
  await title.fill('Villain');
  await title.press('Enter');
  await expect(page).toHaveURL(/note=Templates(%2F|\/)Villain\.md/);
  await editor(page).click();
  await page.keyboard.type('Name: {{title}}');
  await leaveEditor(page);

  await showFiles(page);
  await files.getByRole('button', { name: 'New note from template' }).click();
  await page.getByRole('menuitem', { name: 'Villain' }).click();
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

test('notes show up in the search (Ctrl+K) and open from there', async ({ page }) => {
  await newNote(page, 'Yawning Portal');
  await editor(page).click();
  await page.keyboard.type('A tavern with a well to Undermountain.');
  await page.waitForTimeout(700);
  await page.goto('./#/compendium');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search everything').fill('undermountain');
  const option = page.getByRole('option', { name: /Yawning Portal/ });
  await expect(option).toContainText('A tavern with a well to Undermountain.');
  await option.click();
  await expect(page.getByLabel('Note title')).toHaveValue('Yawning Portal');
});
