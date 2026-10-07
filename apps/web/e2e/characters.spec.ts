import { expect, test } from '@playwright/test';
import { installData } from './helpers/journal';

/** Characters: build one step by step; every choice the rules ask for is tracked and kept. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

test('a character is built from its choices and kept', async ({ page }) => {
  await page.goto('./#/characters');
  await page.getByRole('button', { name: 'New character' }).click();
  const form = page.getByRole('form', { name: 'New character' });
  await form.getByLabel('Name').fill('Lia');
  await form.getByRole('radio', { name: '2014 rules' }).check();
  await form.getByRole('button', { name: 'Start building' }).click();

  // Class: picked from the compendium, then its choices appear.
  await page.getByRole('searchbox', { name: 'Search classes' }).fill('bard');
  await page.getByRole('list', { name: 'classes' }).getByRole('button', { name: /Bard/ }).click();
  const skills = page.getByRole('region', { name: 'Choose 3 skills' });
  for (const skill of ['Arcana', 'History', 'Stealth'])
    await skills.getByRole('checkbox', { name: skill }).click();
  await expect(skills.getByRole('checkbox', { name: 'Athletics' })).toBeDisabled();

  // Level 3 asks for the subclass.
  await page.getByLabel('Level', { exact: true }).selectOption('3');
  const college = page.getByRole('region', { name: /Choose your/ });
  await college.getByRole('radio', { name: /College of Lore/ }).click();
  await expect(page.getByText('College of Lore').first()).toBeVisible();

  // Species, with its subspecies.
  await page.getByRole('link', { name: /Species/ }).click();
  await page.getByRole('list', { name: 'species' }).getByRole('button', { name: /Elf/ }).click();
  await page
    .getByRole('region', { name: 'Choose a subspecies' })
    .getByRole('radio', { name: /High/ })
    .click();

  // Abilities: the standard array plus the species' increases.
  await page.getByRole('link', { name: /Abilities/ }).click();
  const dex = page.getByRole('row', { name: /Dexterity/ });
  await expect(dex).toContainText('Elf');
  await expect(dex.getByRole('cell').nth(2)).toHaveText('16');
  await page.getByLabel('Strength base score').selectOption('8');
  await page.getByLabel('Charisma base score').selectOption('15');
  await expect(page.getByRole('status')).toHaveCount(0);

  // Everything is kept: after a reload the choices are still there.
  await page.reload();
  await page.getByRole('link', { name: /Class/ }).click();
  await expect(page.getByRole('region', { name: 'Choose 3 skills' })).toContainText(
    'Arcana, History, Stealth',
  );
  await page.getByRole('link', { name: 'Characters', exact: true }).first().click();
  await expect(page.getByRole('link', { name: /Lia/ })).toContainText('Level 3 Elf Bard');
});
