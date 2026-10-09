import { expect, test } from '@playwright/test';
import { createCampaign, installData, showFiles } from './helpers/journal';

/** Encounters: monsters from the compendium, their difficulty, and the fight on a board. */

test.beforeEach(async ({ page }) => {
  await installData(page);
});

test('an encounter opens as a filled combat tracker on a board in one click', async ({ page }) => {
  // A campaign with a character in it.
  await createCampaign(page, 'Rust and Sunfire', '2014 rules');
  // An XP campaign: encounters show what they are worth.
  await page.goto('./#/campaigns/rust-and-sunfire');
  await page.getByRole('radio', { name: /Experience points/ }).check();
  await page.goto('./#/characters');
  await page.getByRole('button', { name: 'New character' }).click();
  const form = page.getByRole('form', { name: 'New character' });
  await form.getByLabel('Name').fill('Brakka');
  await form.getByRole('button', { name: 'Start building' }).click();
  await page
    .getByRole('list', { name: 'classes' })
    .getByRole('button', { name: /Fighter/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add class' }).click();
  await page.getByLabel('Level', { exact: true }).selectOption('3');

  // Send to → Encounter from the goblin's page starts an encounter.
  await page.goto(`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New encounter with Goblin/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await expect(page.getByRole('textbox', { name: 'Encounter name' })).toHaveValue(
    'Goblin encounter',
  );

  // Four goblins and their boss; the party is the campaign's character.
  const goblins = page.getByRole('listitem', { name: 'Goblin', exact: true });
  for (let i = 0; i < 3; i++)
    await goblins.getByRole('button', { name: 'One more Goblin' }).click();
  await expect(goblins.getByLabel('Goblin count')).toHaveText('4');
  await page.getByRole('searchbox', { name: 'Add a monster' }).fill('goblin boss');
  await page
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /Goblin Boss/ })
    .click();
  await expect(page.getByRole('listitem', { name: 'Goblin Boss' })).toBeVisible();
  const difficulty = page.getByRole('complementary', { name: 'Difficulty' });
  await expect(difficulty).toContainText('Brakka · level 3');
  // Each monster and character opens to what it is.
  await goblins.getByRole('button', { name: 'Show Goblin' }).click();
  await expect(goblins).toContainText('Scimitar');
  const party = page.getByRole('region', { name: 'Party' });
  await party.getByRole('button', { name: /Brakka/ }).click();
  await expect(party.getByRole('listitem', { name: 'Brakka' })).toContainText('AC');
  // 4 × 50 + 200 = 400 XP for one 3rd-level character.
  await expect(difficulty).toContainText('400 XP');

  // One click: a board with the tracker, filled with the monsters and the character.
  await page.getByRole('button', { name: 'Run on a board' }).click();
  await expect(page).toHaveURL(/#\/boards\/[a-z0-9]+\?focus=/);
  const order = page.getByRole('list', { name: 'Combat order' });
  await expect(order.getByRole('listitem')).toHaveCount(6);
  for (const name of ['Goblin 1', 'Goblin 4', 'Goblin Boss', 'Brakka'])
    await expect(order.getByRole('listitem', { name, exact: true })).toBeVisible();

  // The fight: turns go round, damage comes off, conditions stick.
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(order.locator('[aria-current="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next turn' }).click();
  const brakka = order.getByRole('listitem', { name: 'Brakka' });
  const hp = brakka.getByLabel('Brakka hit points');
  const max = (await hp.textContent())?.split('/')[1] ?? '';
  await brakka.getByLabel('Brakka damage or healing').fill('3');
  await brakka.getByRole('button', { name: 'Damage Brakka' }).click();
  await expect(hp).toHaveText(`${String(Number(max) - 3)}/${max}`);
  await brakka.getByLabel('Add a condition to Brakka').selectOption('Prone');
  await expect(brakka.getByRole('button', { name: 'Remove Prone from Brakka' })).toBeVisible();
  await brakka.getByRole('button', { name: 'Brakka concentrating' }).click();
  await expect(brakka.getByRole('button', { name: 'Brakka concentrating' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Kept after a reload.
  await page.reload();
  await expect(
    page.getByRole('list', { name: 'Combat order' }).getByRole('listitem', { name: 'Brakka' }),
  ).toContainText('Prone');
});

test('the encounters list groups encounters by campaign', async ({ page }) => {
  await page.goto('./#/encounters');
  await page.getByRole('button', { name: 'New encounter' }).click();
  await page.getByLabel('Name').fill('Owlbear den');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('textbox', { name: 'Encounter name' })).toHaveValue('Owlbear den');
  // Outside campaigns the party is typed in by hand.
  await page.getByLabel('Character levels').fill('5, 5, 5, 5');
  await page.getByLabel('Character levels').blur();
  await page.getByRole('searchbox', { name: 'Add a monster' }).fill('goblin');
  await page
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /Goblin/ })
    .first()
    .click();
  await expect(page.getByRole('complementary', { name: 'Difficulty' })).toContainText('Party (4)');
  await page.getByRole('link', { name: 'All encounters' }).click();
  await expect(page.getByRole('region', { name: 'Not in a campaign' })).toContainText(
    'Owlbear den',
  );
});

test('milestone campaigns show difficulty without XP', async ({ page }) => {
  await createCampaign(page, 'Lost Mine');
  await page.goto(`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New encounter with Goblin/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await page.getByLabel('Character levels').fill('3, 3');
  await page.getByLabel('Character levels').blur();
  const difficulty = page.getByRole('complementary', { name: 'Difficulty' });
  await expect(difficulty.getByLabel(/^Difficulty: /)).toBeVisible();
  await expect(difficulty).not.toContainText('XP');
  await expect(page.getByRole('listitem', { name: 'Goblin' })).not.toContainText('XP');
});

test('a campaign NPC with a stat block joins an encounter by name', async ({ page }) => {
  await createCampaign(page, 'Rust and Sunfire');
  await page.goto('./#/journal');
  await showFiles(page);
  await page
    .getByRole('navigation', { name: 'Journal files' })
    .filter({ visible: true })
    .getByRole('button', { name: 'New note from template' })
    .click();
  await page.getByRole('menuitem', { name: 'NPC', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: 'New NPC' });
  await wizard.getByLabel('Name', { exact: true }).fill('Brakka the Boss');
  await wizard.getByRole('button', { name: /In a fight/ }).click();
  await wizard.getByRole('searchbox', { name: 'Stat block' }).fill('goblin boss');
  await wizard
    .getByRole('list', { name: 'Found' })
    .getByRole('button', { name: /Goblin Boss/ })
    .click();
  await expect(wizard).toContainText('Goblin Boss');
  await wizard.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Brakka the Boss');

  // In an encounter of the campaign, the NPC is offered by name, beside its goblins.
  await page.goto(`./#/compendium/${encodeURIComponent('monster:goblin@mm')}`);
  await page.getByRole('button', { name: 'Send to' }).click();
  await page.getByRole('menuitem', { name: /New encounter with Goblin/ }).click();
  await page.getByRole('status').getByRole('link').click();
  await page.getByLabel('Add from the journal').selectOption({ label: 'Brakka the Boss' });
  const brakka = page.getByRole('listitem', { name: 'Brakka the Boss' });
  await expect(brakka).toContainText('(Goblin Boss)');
  await brakka.getByRole('button', { name: 'Show Brakka the Boss' }).click();
  await expect(brakka).toContainText('Scimitar');
  await brakka.getByRole('link', { name: 'Brakka the Boss' }).click();
  await expect(page.getByLabel('Note title')).toHaveValue('Brakka the Boss');
});
