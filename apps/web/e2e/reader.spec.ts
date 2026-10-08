import { expect, test, type Page } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Book and adventure reader on the fixture dataset: library, contents, chapters, area links. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

/** The contents sidebar on desktop, or the drawer on phones. */
async function contents(page: Page) {
  const isPhone = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isPhone) await page.getByRole('button', { name: 'Contents' }).click();
  return page.getByRole('navigation', { name: 'Contents' }).filter({ visible: true });
}

test('open an adventure from the library and navigate its chapters', async ({ page }) => {
  await page.goto('./#/compendium');
  await page
    .getByRole('navigation', { name: 'Library' })
    .getByRole('link', { name: 'Books' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible();
  await page.getByRole('radio', { name: 'Adventures' }).click();
  await expect(page.getByRole('heading', { name: 'Starter Set' })).toBeVisible();
  await page.getByRole('link', { name: /Lost Mine of Phandelver/ }).click();

  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Chapters' })
    .getByRole('button', { name: /Goblin Arrows/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Part 1: Goblin Arrows' })).toBeVisible();
  await expect(page).toHaveURL(/LMoP\?ch=1$/);

  // Jump to a header from the contents.
  await (await contents(page)).getByRole('button', { name: 'Cragmaw Hideout' }).click();
  await expect(page).toHaveURL(/ch=1&h=Cragmaw\+Hideout$/);
  await expect(page.getByRole('heading', { name: 'Cragmaw Hideout' })).toBeInViewport();

  // Area links go to the right chapter and section.
  await page.getByRole('link', { name: 'the cave mouth' }).click();
  await expect(page).toHaveURL(/ch=2&area=lmop-cave$/);
  await expect(page.getByText('A stream flows out of the cave.')).toBeInViewport();
});

test('deep links survive a reload', async ({ page }) => {
  await page.goto('./#/compendium/adventure/LMoP?ch=2');
  await expect(page.getByRole('heading', { name: 'Part 2: Phandalin' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Part 2: Phandalin' })).toBeVisible();
  await expect(page).toHaveURL(/LMoP\?ch=2$/);
});
