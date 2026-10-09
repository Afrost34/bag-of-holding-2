import { expect, test, type Page } from '@playwright/test';
import { mockGitHub } from './helpers/github';

/** Campaigns: templates, per-campaign sources and notes, switching. Fixture data. */

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 30_000 });
});

const MISSILE = './#/compendium/spell%3Amagic%20missile%40phb';

async function writeNote(page: Page, text: string) {
  await page.goto(MISSILE);
  await page.getByRole('button', { name: /Add note|Edit note/ }).click();
  await page.getByLabel('Your note on Magic Missile').fill(text);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(600); // saved shortly after typing
}

async function createCampaign(page: Page, name: string, template: string) {
  await page.goto('./#/campaigns');
  await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();
  const first = await page.getByRole('heading', { name: 'Create your first campaign' }).isVisible();
  if (!first) await page.getByRole('button', { name: 'New campaign' }).click();
  await page.getByLabel('Campaign name').fill(name);
  await page
    .getByRole('group', { name: 'Start from a template' })
    .getByRole('radio', { name: template })
    .check();
  await page.getByRole('button', { name: 'Create campaign' }).click();
  // The first campaign opens the compendium; later ones stay on the list.
  if (first) await page.waitForURL(/#\/compendium$/);
  else await expect(page.getByRole('region', { name: 'New campaign' })).toHaveCount(0);
}

test('campaigns keep their own sources and notes', async ({ page }) => {
  // A note made before any campaign exists moves into the first campaign.
  await writeNote(page, 'Noted before campaigns.');
  await createCampaign(page, 'Rust & Sunfire', '2024 rules');
  await page.goto(MISSILE);
  await expect(page.getByText('Noted before campaigns.')).toBeVisible();

  await page.goto('./#/compendium/list/spells');
  await expect(page.getByText('3 spells', { exact: true })).toBeVisible();

  // A 2014 campaign: the 2024 Player's Handbook is off, and notes start empty.
  await createCampaign(page, 'Old School', '2014 rules');
  await page.goto('./#/compendium/list/spells');
  await expect(page.getByText('2 spells', { exact: true })).toBeVisible();
  await page.goto(MISSILE);
  await expect(page.getByText('Noted before campaigns.')).toHaveCount(0);
  await writeNote(page, 'Old School note.');

  // Back to Rust & Sunfire: its sources and its note return.
  await page.goto('./#/campaigns');
  await page.getByRole('button', { name: 'Open Rust & Sunfire' }).click();
  await page.goto(MISSILE);
  await expect(page.getByText('Noted before campaigns.')).toBeVisible();
  await expect(page.getByText('Old School note.')).toHaveCount(0);
  await page.goto('./#/compendium/list/spells');
  await expect(page.getByText('3 spells', { exact: true })).toBeVisible();

  // The choice survives a reload.
  await page.reload();
  await expect(page.getByText('3 spells', { exact: true })).toBeVisible();
});

test('every setting can be chosen when creating a campaign', async ({ page }) => {
  await page.goto('./#/campaigns');
  await page.getByLabel('Campaign name').fill('Custom');
  // The template fills the settings in; each can then be changed.
  await page
    .getByRole('group', { name: 'Start from a template' })
    .getByRole('radio', { name: /^2014 rules/ })
    .check();
  await expect(
    page.getByRole('group', { name: 'Edition' }).getByRole('radio', { name: /^2014 rules/ }),
  ).toBeChecked();
  await page
    .getByRole('group', { name: 'Edition' })
    .getByRole('radio', { name: /Mixed editions/ })
    .check();
  await page.getByRole('radio', { name: /Variant/ }).check();
  // Books are covers: the 2014 template turned the 2024 Player's Handbook off; turn it back on
  // and turn the 2014 one off instead.
  await page.getByRole('button', { name: "Player's Handbook (2024): off" }).click();
  await page.getByRole('button', { name: "Player's Handbook (2014): on" }).click();
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await page.waitForURL(/#\/compendium$/);

  await page.goto('./#/compendium/list/spells');
  await expect(page.getByText('1 spell', { exact: true })).toBeVisible();
  await page.goto('./#/campaigns/custom');
  await expect(page.getByRole('radio', { name: /Mixed editions/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Variant/ })).toBeChecked();
  await expect(page.getByRole('button', { name: "Player's Handbook (2014): off" })).toBeVisible();
});

test('campaign settings: rename, rules, save as template, delete', async ({ page }) => {
  await createCampaign(page, 'Rust & Sunfire', '2024 rules');
  await page.goto('./#/campaigns');
  await page.getByRole('link', { name: 'Settings of Rust & Sunfire' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rust & Sunfire' })).toBeVisible();

  await page.getByRole('radio', { name: /Variant/ }).check();
  await page.getByLabel('Template name').fill('Our table');
  await page.getByRole('button', { name: 'Save as template' }).click();
  await expect(page.getByRole('status').getByText('Saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('radio', { name: /Variant/ })).toBeChecked();

  // A cover picture, shown on the campaign's card.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByLabel('Cover picture')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: 'Cover of Rust & Sunfire' })).toBeVisible();
  await page.goto('./#/campaigns');
  await expect(page.getByRole('list', { name: 'Your campaigns' }).locator('img')).toHaveCount(1);
  await page.getByRole('link', { name: 'Settings of Rust & Sunfire' }).click();

  await page.goto('./#/campaigns');
  await page.getByRole('button', { name: 'New campaign' }).click();
  await expect(page.getByRole('radio', { name: 'Our table' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('link', { name: 'Settings of Rust & Sunfire' }).click();
  await page.getByRole('button', { name: 'Delete…' }).click();
  await page.getByRole('button', { name: 'Delete Rust & Sunfire' }).click();
  await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible();
});
