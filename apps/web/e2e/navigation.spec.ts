import { expect, test } from '@playwright/test';
import { installData } from './helpers/journal';

/** Going back comes back to where the page was scrolled. */

test('back returns to the place in the list the entry was opened from', async ({ page }) => {
  await installData(page);
  // A short window, so the list scrolls.
  await page.setViewportSize({ width: 1100, height: 360 });
  await page.goto('./#/compendium/list/spells');
  // The list scrolls a box of its own.
  const main = page.locator('[data-scroll-memory="list"]');
  const list = page.getByRole('list', { name: 'Spells list' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  // An open row makes the page long enough to scroll.
  await list.getByRole('button', { name: /Magic Missile/ }).click();
  await expect(page.getByRole('link', { name: 'View details page' })).toBeVisible();
  const max = await main.evaluate((el) => el.scrollHeight - el.clientHeight);
  test.skip(max < 60, 'The list is too short to scroll.');
  const at = Math.min(150, max);
  await main.evaluate((el, top) => {
    el.scrollTop = top;
  }, at);
  await page.getByRole('link', { name: 'View details page' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Magic Missile' })).toBeVisible();
  await page.goBack();
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(at - 5);
});
