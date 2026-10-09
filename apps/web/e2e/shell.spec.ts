import { expect, test, type Page } from '@playwright/test';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Opens the navigation (drawer on phones) and returns the nav landmark. */
async function openNav(page: Page) {
  if (isPhone(page)) await page.getByRole('button', { name: 'Open menu' }).click();
  return page.getByRole('navigation', { name: 'Main' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('home page lists every module', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Bag of Holding' })).toBeVisible();
  for (const name of ['Compendium', 'Campaigns', 'Journal', 'Characters', 'Boards', 'Maps']) {
    await expect(
      page.getByRole('main').getByRole('link', { name: new RegExp(name) }),
    ).toBeVisible();
  }
});

test('navigating updates the URL and the active tab', async ({ page }) => {
  const nav = await openNav(page);
  await nav.getByRole('link', { name: /Compendium/ }).click();
  await expect(page).toHaveURL(/#\/compendium$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Compendium' })).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Compendium/);
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('deep links open the right page', async ({ page }) => {
  await page.goto('./#/maps');
  await expect(page.getByRole('heading', { level: 1, name: 'Maps' })).toBeVisible();
  await page.goto('./#/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('tabs open, switch, close and survive a reload', async ({ page }) => {
  test.skip(isPhone(page), 'Ctrl+click is a desktop gesture');
  const nav = page.getByRole('navigation', { name: 'Main' });

  await nav.getByRole('link', { name: /Boards/ }).click();
  await nav.getByRole('link', { name: /Maps/ }).click({ modifiers: ['Control'] });

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Maps/);
  await expect(page).toHaveURL(/#\/maps$/);

  await tabs.filter({ hasText: 'Boards' }).click();
  await expect(page).toHaveURL(/#\/boards$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Boards' })).toBeVisible();

  await page.reload();
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Boards/);

  await page.getByRole('button', { name: 'Close Boards' }).click();
  await expect(tabs).toHaveCount(1);
  await expect(page).toHaveURL(/#\/maps$/);

  await page.getByRole('button', { name: 'New tab' }).click();
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/Home/);
});

test('theme choice applies and persists', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'System' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('phone drawer navigates and closes', async ({ page }) => {
  test.skip(!isPhone(page), 'Drawer only exists on small screens');
  const nav = await openNav(page);
  await nav.getByRole('link', { name: /Settings/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
});

test('keyboard shortcuts open modules, tabs, search and their own list', async ({ page }) => {
  test.skip(isPhone(page), 'Keyboards are for the desktop.');
  await page.goto('./#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Bag of Holding' })).toBeVisible();
  await page.keyboard.press('Alt+2');
  await expect(page).toHaveURL(/#\/compendium$/);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(1);
  await page.keyboard.press('Alt+T');
  await expect(tabs).toHaveCount(2);
  await page.keyboard.press('Alt+PageUp');
  await expect(page).toHaveURL(/#\/compendium$/);
  await page.keyboard.press('Alt+W');
  await expect(tabs).toHaveCount(1);
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await expect(help.getByRole('region', { name: 'Maps' })).toContainText('Spell template');
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible();
});

test('right-click shows the app menu for what was clicked', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Right-click is a desktop gesture.');
  const nav = await openNav(page);
  await nav.getByRole('link', { name: 'Maps' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Actions' });
  await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Open in a new tab' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Maps/ })).toHaveCount(1);
  // Anywhere else: moving around.
  await page.getByRole('main').click({ button: 'right', position: { x: 5, y: 5 } });
  await expect(menu.getByRole('menuitem', { name: 'Back' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});
