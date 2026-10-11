import { expect, test } from '@playwright/test';

const zipPath = process.env.TEMP + '/mini_core.zip';
const out = process.env.TEMP + '/ui-';

test('tool panels', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/maps');
  await page.getByRole('button', { name: 'New map' }).click();
  await page.getByLabel('Name').fill('UI');
  await page.getByRole('button', { name: 'Create' }).click();
  const canvas = page.getByRole('application', { name: 'Map canvas' });
  await expect(canvas.locator('canvas')).toHaveCount(1);
  const tools = page.getByRole('toolbar', { name: 'Map tools' });
  await tools.getByRole('button', { name: 'Stamp', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import packs (zip)' }).click();
  await (await chooser).setFiles(zipPath);
  await expect(page.getByRole('status').filter({ hasText: /added|failed/ })).toBeVisible({ timeout: 60_000 });
  const names = await tools.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent));
  console.log('TOOLS', JSON.stringify(names));
  for (const n of ['Terrain brush', 'Terrain shape', 'Road or river', 'Room', 'Building', 'District', 'Scatter', 'Door', 'Stamp']) {
    const b = tools.getByRole('button', { name: n, exact: true });
    if (await b.count()) { await b.click(); await page.waitForTimeout(400); await page.screenshot({ path: out + n + '.png' }); }
  }
});
