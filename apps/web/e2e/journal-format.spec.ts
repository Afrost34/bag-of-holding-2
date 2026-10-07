import { expect, test, type Page } from '@playwright/test';
import { createCampaign, editor, installData, newNote } from './helpers/journal';

/** Journal: formatting with the toolbar and the "/" menu, without writing Markdown. */

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Format');
  await page.goto('./#/journal');
  await newNote(page, 'Session 1');
  await editor(page).click();
});

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });

async function leaveEditor(page: Page) {
  await page.getByLabel('Note title').click();
}

test('the toolbar formats text', async ({ page }) => {
  // Pick a format, then type (as on a phone, without selecting text first).
  await toolbar(page).getByRole('button', { name: 'Text style' }).click();
  await page.getByRole('menuitem', { name: 'Heading 1' }).click();
  await page.keyboard.type('Arrival');
  await page.keyboard.press('Enter');
  // Bold on, type, Bold again to carry on in plain text.
  await toolbar(page).getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('Bold words');
  await toolbar(page).getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' then plain.');
  await page.keyboard.press('Enter');
  await toolbar(page).getByRole('button', { name: 'Checklist' }).click();
  await page.keyboard.type('Find the shard');
  // Enter continues the checklist; the roll goes in the next item.
  await page.keyboard.press('Enter');
  await toolbar(page).getByRole('button', { name: 'Dice roll' }).click();
  await leaveEditor(page);

  await expect(editor(page).locator('.cm-jh1')).toHaveText('Arrival');
  await expect(editor(page).locator('.cm-jstrong')).toHaveText('Bold words');
  await editor(page).getByRole('checkbox', { name: 'To do' }).first().click();
  await expect(editor(page).getByRole('checkbox', { name: 'Done' })).toBeChecked();
  await expect(editor(page).getByRole('button', { name: '1d20' })).toBeVisible();
});

test('typing / offers blocks to insert', async ({ page }) => {
  await page.keyboard.type('/tab');
  await page.getByRole('option', { name: /^Table/ }).click();
  await leaveEditor(page);
  // Tables are edited in place, cell by cell.
  const firstCell = editor(page).getByLabel('Row 1, column 1');
  await expect(firstCell).toHaveValue('Column 1');
  await firstCell.fill('Name');
  await firstCell.blur();
  await expect(firstCell).toHaveValue('Name');

  await editor(page).locator('.cm-line').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/warn');
  await page.getByRole('option', { name: /^Warning callout/ }).click();
  await page.keyboard.type('Ambush ahead');
  await leaveEditor(page);
  await expect(editor(page).locator('.cm-jcallout-warning').first()).toContainText('Ambush ahead');
});
