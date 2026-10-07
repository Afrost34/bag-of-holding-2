import { expect, test, type Page } from '@playwright/test';
import { FakeDataRepo } from './helpers/fakeDataRepo';
import { mockGitHub } from './helpers/github';
import { createCampaign, installData } from './helpers/journal';

/**
 * A new device, from nothing to a working campaign with only what the home page shows: the
 * plan's "fresh install on a second machine … without help".
 */

const step = (page: Page, n: number) =>
  page
    .getByRole('list', { name: 'First steps' })
    .getByRole('listitem', { name: new RegExp(`^Step ${String(n)}:`) });

async function downloadFromHome(page: Page) {
  await page.getByRole('button', { name: 'Download the data' }).click();
  await expect(step(page, 1)).toHaveAccessibleName(/\(done\)$/, { timeout: 30_000 });
}

test('a first device: the data and a campaign, from the home page', async ({ page }) => {
  await mockGitHub(page);
  await page.goto('./#/');
  await expect(page.getByRole('region', { name: 'Get started' })).toBeVisible();
  await downloadFromHome(page);
  await step(page, 3).getByRole('link', { name: 'Create a campaign' }).click();
  await page.getByLabel('Campaign name').fill('Lost Mine');
  await page.getByRole('button', { name: 'Create campaign' }).click();
  // The first campaign opens the compendium.
  await page.waitForURL(/#\/compendium$/);
  await page.goto('./#/');
  await expect(page.getByRole('region', { name: 'Get started' })).toHaveCount(0);
  await expect(page.getByText(/entries ready/)).toBeVisible();
});

test('a second device: sync brings the first device’s campaign, then the data', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  // The first device: a campaign, synced to the data repository.
  const repo = new FakeDataRepo();
  await repo.attach(page);
  await installData(page);
  await createCampaign(page, 'Rust & Sunfire');
  await page.goto('./#/settings/sync');
  await page.getByLabel('Repository').fill('me/bag-of-holding-2-data');
  await page.getByLabel('Token').fill('github_pat_test');
  await page.getByLabel('Name of this device').fill('PC');
  await page.getByRole('button', { name: 'Connect and sync' }).click();
  await expect(page.getByRole('status')).toContainText('Synced at');

  // The second device starts empty and follows the home page.
  const context = await browser.newContext();
  const phone = await context.newPage();
  await repo.attach(phone);
  await mockGitHub(phone);
  await phone.goto('./#/');
  await expect(phone.getByRole('region', { name: 'Get started' })).toBeVisible();
  await step(phone, 2).getByRole('link', { name: 'Connect sync' }).click();
  await phone.getByLabel('Repository').fill('me/bag-of-holding-2-data');
  await phone.getByLabel('Token').fill('github_pat_test');
  await phone.getByLabel('Name of this device').fill('Laptop');
  await phone.getByRole('button', { name: 'Connect and sync' }).click();
  await expect(phone.getByRole('status')).toContainText('Synced at');
  await phone.goto('./#/');
  await expect(step(phone, 2)).toHaveAccessibleName(/\(done\)$/);
  await expect(step(phone, 3)).toHaveAccessibleName(/\(done\)$/);
  // The last step: once the data is in, there is nothing left to start.
  await phone.getByRole('button', { name: 'Download the data' }).click();
  await expect(phone.getByRole('region', { name: 'Get started' })).toHaveCount(0, {
    timeout: 30_000,
  });
  await phone.goto('./#/campaigns');
  await expect(phone.getByRole('main')).toContainText('Rust & Sunfire');
  await context.close();
});
