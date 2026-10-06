import { createHash } from 'node:crypto';
import { fixtureFiles } from '@boh/data5e/testing';
import { expect, test, type Page } from '@playwright/test';

/**
 * The data flow end to end, with GitHub replaced by the fixture dataset: download, sources,
 * search, persistence, homebrew and deletion. Never touches the network.
 */

const REPO = '5etools-mirror-3/5etools-src';
const TAG = 'v9.9.9';

function serialise(content: unknown): Buffer {
  return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
}

async function mockGitHub(page: Page) {
  const files = fixtureFiles();
  const tree = Object.entries(files).map(([path, content]) => {
    const body = serialise(content);
    const sha = createHash('sha1')
      .update(Buffer.concat([Buffer.from(`blob ${String(body.length)}\0`), body]))
      .digest('hex');
    return { path, type: 'blob', sha, size: body.length };
  });
  const json = (body: unknown) => ({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

  await page
    .context()
    .route(`https://api.github.com/repos/${REPO}/releases/latest`, (route) =>
      route.fulfill(json({ tag_name: TAG })),
    );
  await page
    .context()
    .route(`https://api.github.com/repos/${REPO}/git/trees/**`, (route) =>
      route.fulfill(json({ tree, truncated: false })),
    );
  await page.context().route(`https://raw.githubusercontent.com/${REPO}/${TAG}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.split(`/${TAG}/`)[1] ?? '';
    const content = files[path];
    return content === undefined
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          body: serialise(content),
        });
  });
}

async function search(page: Page, text: string) {
  await page.getByLabel('Search the data').fill(text);
  return page.getByRole('table', { name: 'Search results' });
}

test.beforeEach(async ({ page }) => {
  await mockGitHub(page);
});

test('downloads, searches, filters by source and survives a reload', async ({ page }) => {
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible({ timeout: 30_000 });

  const results = await search(page, 'fire');
  const phb = results.getByRole('row', { name: 'Fireball Spell PHB2014', exact: true });
  const xphb = results.getByRole('row', { name: 'Fireball Spell XPHB2024', exact: true });
  await expect(phb).toBeVisible();
  await expect(xphb).toBeVisible();

  // Turning off the 2014 core books hides their entries.
  const core2014 = page.getByRole('button', { name: /Core rules \(2014\)/ }).locator('..');
  await core2014.getByRole('button', { name: 'None' }).click();
  await expect(xphb).toBeVisible();
  await expect(phb).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible();
  await page.goto('./#/');
  await expect(page.getByText(/entries ready/)).toBeVisible();
});

test('imports homebrew and deletes downloaded data', async ({ page }) => {
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(`Version ${TAG}`)).toBeVisible({ timeout: 30_000 });

  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: 'Rust & Sunfire.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        _meta: { sources: [{ json: 'RustSunfire', full: 'Rust & Sunfire Homebrew' }] },
        item: [{ name: 'Ember Orb', source: 'RustSunfire', rarity: 'common' }],
      }),
    ),
  });
  await expect(page.getByText('rust-sunfire.json · 1 entries')).toBeVisible({ timeout: 15_000 });
  const results = await search(page, 'ember');
  await expect(results.getByRole('row', { name: /Ember Orb.*RustSunfire/ })).toBeVisible();

  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"spell": []}'),
  });
  await expect(page.getByRole('alert')).toContainText('Not a 5etools homebrew file');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete downloaded data' }).click();
  await expect(page.getByRole('button', { name: 'Download 5etools data' })).toBeVisible();
});
