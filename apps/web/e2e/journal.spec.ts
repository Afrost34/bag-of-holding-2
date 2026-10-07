import { expect, test } from '@playwright/test';
import { createCampaign, editor, installData, newNote } from './helpers/journal';

/** Journal: notes per campaign, [[links]] to notes and the compendium, renames. Fixture data. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

test('notes link to each other and to the compendium', async ({ page }) => {
  await createCampaign(page, 'Rust & Sunfire');
  await page.goto('./#/journal');
  await expect(page.getByRole('heading', { name: 'Rust & Sunfire journal' })).toBeVisible();

  await newNote(page, 'Waterdeep');
  await newNote(page, 'Session 1');

  // `[[` suggests notes, then compendium entries; a type prefix narrows the search.
  await editor(page).click();
  await page.keyboard.type('We reached [[Water');
  await page.getByRole('option', { name: /^Waterdeep/ }).click();
  await page.keyboard.type(' and I cast [[spell:magic mi');
  await page
    .getByRole('option', { name: /^Magic Missile/ })
    .first()
    .click();
  await page.getByLabel('Note title').click(); // leave the line so links show as links
  await expect(editor(page)).toContainText('We reached Waterdeep and I cast Magic Missile');

  // A note link opens the note, which lists where it is linked from.
  await editor(page).getByText('Waterdeep', { exact: true }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Waterdeep');
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    await expect(
      page.getByRole('complementary', { name: 'Backlinks' }).getByRole('button', {
        name: 'Session 1',
      }),
    ).toBeVisible();
  }

  // Renaming a note rewrites the links that point at it.
  const name = page.getByLabel('Note title');
  await name.fill('Waterdeep City');
  await name.press('Enter');
  await expect(page).toHaveURL(/note=Waterdeep%20City\.md/);
  await page.goto('./#/journal?note=Session%201.md');
  await expect(editor(page)).toContainText('We reached Waterdeep City');

  // Hovering a link with a mouse previews what it points at.
  const desktop = (page.viewportSize()?.width ?? 0) >= 768;
  if (desktop) {
    await editor(page).getByText('Waterdeep City', { exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: 'Link preview' })).toContainText(
      'Waterdeep City',
    );
    await editor(page).getByText('Magic Missile', { exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: 'Link preview' })).toContainText('1st-level');
  }

  // A compendium link opens the entry.
  await editor(page).getByText('Magic Missile', { exact: true }).click();
  await expect(page).toHaveURL(/#\/compendium\/spell/);
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();

  // Notes survive a reload.
  await page.goto('./#/journal?note=Session%201.md');
  await page.reload();
  await expect(editor(page)).toContainText('We reached Waterdeep City');
});

test('each campaign has its own journal', async ({ page }) => {
  await createCampaign(page, 'First');
  await page.goto('./#/journal');
  await newNote(page, 'Only here');

  await createCampaign(page, 'Second');
  await page.goto('./#/journal');
  await expect(page.getByRole('heading', { name: 'Second journal' })).toBeVisible();
  await expect(page.getByText('Only here')).toHaveCount(0);

  await page.goto('./#/campaigns');
  await page.getByRole('button', { name: 'Open First' }).click();
  await page.goto('./#/journal?note=Only%20here.md');
  await expect(page.getByLabel('Note title')).toHaveValue('Only here');
});

test('notes move into folders by drag and drop or the Move to menu', async ({ page }) => {
  await createCampaign(page, 'Moves');
  await page.goto('./#/journal');
  await newNote(page, 'Waterdeep');
  const files = page.getByRole('navigation', { name: 'Journal files' }).filter({ visible: true });
  const phone = (page.viewportSize()?.width ?? 0) < 768;
  if (phone) await page.getByRole('button', { name: 'Files', exact: true }).click();
  await files.getByRole('button', { name: 'New folder' }).click();
  const note = files.getByRole('treeitem', { name: 'Waterdeep' });
  const folder = files.getByRole('treeitem', { name: 'New folder' });
  await expect(folder).toBeVisible();

  if (phone) {
    await files.getByRole('button', { name: 'Actions for Waterdeep' }).click();
    await page.getByRole('menuitem', { name: 'Move to…' }).click();
    await page.getByRole('menuitem', { name: 'New folder' }).click();
  } else {
    await note.getByRole('button', { name: 'Waterdeep', exact: true }).dragTo(folder);
  }
  // The open note follows the move.
  await expect(page).toHaveURL(/note=New%20folder(%2F|\/)Waterdeep\.md/);
  await expect(page.getByLabel('Note title')).toHaveValue('Waterdeep');
});
