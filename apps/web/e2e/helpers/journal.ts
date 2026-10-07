import { expect, type Page } from '@playwright/test';
import { mockGitHub } from './github';

/** Shared steps for the journal specs. */

export async function installData(page: Page) {
  await mockGitHub(page);
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
}
export async function createCampaign(page: Page, name: string) {
  await page.goto('./#/campaigns');
  await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();
  const first = await page.getByRole('heading', { name: 'Create your first campaign' }).isVisible();
  if (!first) await page.getByRole('button', { name: 'New campaign' }).click();
  await page.getByLabel('Campaign name').fill(name);
  await page.getByRole('button', { name: 'Create campaign' }).click();
  if (first) await page.waitForURL(/#\/compendium$/);
  else await expect(page.getByRole('region', { name: 'New campaign' })).toHaveCount(0);
}

export async function newNote(page: Page, title: string) {
  // On a phone the file tree sits behind the Files button.
  const files = page.getByRole('button', { name: 'Files', exact: true });
  if ((page.viewportSize()?.width ?? 0) < 768) await files.click();
  await page
    .getByRole('navigation', { name: 'Journal files' })
    .getByRole('button', { name: 'New note', exact: true })
    .filter({ visible: true })
    .click();
  const name = page.getByLabel('Note title');
  await expect(name).toHaveValue(/^Untitled/);
  await name.fill(title);
  await name.press('Enter');
  await expect(page).toHaveURL(new RegExp(`note=${encodeURIComponent(title)}\\.md`));
}

/** The note's editor (embedded notes inside it have editors of their own). */
export const editor = (page: Page) => page.locator('.cm-content').first();

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/** Opens the file tree drawer on a phone (on a larger screen it is always shown). */
export async function showFiles(page: Page) {
  if (isPhone(page)) await page.getByRole('button', { name: 'Files', exact: true }).click();
}
