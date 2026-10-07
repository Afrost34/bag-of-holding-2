import { expect, test } from '@playwright/test';
import { FakeDataRepo } from './helpers/fakeDataRepo';
import { createCampaign, installData, newNote, showFiles } from './helpers/journal';

/** Sync with the private data repository (a fake GitHub in memory). */

test('a device syncs with the data repository, both ways', async ({ page }) => {
  const repo = new FakeDataRepo();
  await repo.attach(page);
  await installData(page);
  await createCampaign(page, 'Rust & Sunfire');
  await page.goto('./#/journal');
  await newNote(page, 'Rustcrown');
  await page.waitForTimeout(700);

  // Connect this device.
  await page.goto('./#/settings/sync');
  await page.getByLabel('Repository').fill('me/bag-of-holding-2-data');
  await page.getByLabel('Token').fill('github_pat_test');
  await page.getByLabel('Name of this device').fill('PC');
  await page.getByRole('button', { name: 'Connect and sync' }).click();
  await expect(page.getByRole('status')).toContainText('Synced at');

  // What was on this device is now in the repository.
  const files = repo.files();
  const notePath = Object.keys(files).find((p) => p.endsWith('/journal/Rustcrown.md'));
  expect(notePath).toBeDefined();
  expect(Object.keys(files).some((p) => p.endsWith('/campaign.json'))).toBe(true);
  expect(Object.keys(files).some((p) => p.startsWith('.sync'))).toBe(false);

  // Another device (the phone) adds a note; syncing brings it here.
  const journalDir = (notePath ?? '').replace(/Rustcrown\.md$/, '');
  repo.push({ [`${journalDir}Written on the phone.md`]: 'Hello from the phone.' });
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Synced at');
  await page.goto('./#/journal');
  await showFiles(page);
  await expect(
    page.getByRole('navigation', { name: 'Journal files' }).filter({ visible: true }),
  ).toContainText('Written on the phone');
});

test('a wrong token is explained', async ({ page }) => {
  await page.route('https://api.github.com/repos/me/data', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ message: 'Bad credentials' }),
    }),
  );
  await page.goto('./#/settings/sync');
  await page.getByLabel('Repository').fill('me/data');
  await page.getByLabel('Token').fill('nope');
  await page.getByRole('button', { name: 'Connect and sync' }).click();
  await expect(page.getByRole('alert')).toContainText('did not accept the token');
});
