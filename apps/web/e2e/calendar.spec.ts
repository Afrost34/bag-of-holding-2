import { expect, test } from '@playwright/test';
import { createCampaign, installData } from './helpers/journal';

/** The campaign calendar: today in the world, events on days, a calendar from Calendarium. */

test.beforeEach(async ({ page }) => {
  await installData(page);
  await createCampaign(page, 'Rust and Sunfire');
});

test('a calendar is started, time moves on, and events are added to days', async ({ page }) => {
  await page.goto('./#/calendar');
  await page.getByRole('button', { name: 'Start a calendar' }).click();
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today).toContainText('1 Deepwinter, Year 1');
  await today.getByRole('button', { name: 'Next day' }).click();
  await expect(today).toContainText('2 Deepwinter, Year 1');

  // An event on the 5th, every year.
  await page.getByRole('button', { name: /, 5 Deepwinter, Year 1$/ }).click();
  const day = page.getByRole('complementary', { name: 'Day' });
  await day.getByRole('button', { name: 'Add an event' }).click();
  const form = day.getByRole('form', { name: 'New event' });
  await form.getByLabel('Name').fill('Market day');
  await form.getByLabel('Every year').check();
  await form.getByRole('button', { name: 'Save event' }).click();
  await expect(day.getByRole('region', { name: 'Events' })).toContainText('Market day');
  await expect(page.getByRole('button', { name: /, 5 Deepwinter, Year 1$/ })).toContainText(
    'Market day',
  );

  // A year later, it comes back; kept after a reload.
  await page.reload();
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('button', { name: /, 5 Deepwinter, Year 2$/ })).toContainText(
    'Market day',
  );
});

test('a calendar comes from Calendarium', async ({ page }) => {
  await page.goto('./#/calendar');
  const data = {
    calendars: [
      {
        name: 'Calendar of the Gradient',
        static: {
          overflow: false,
          weekdays: ['Char', 'Igni', 'Flux', 'Main', 'Mid'].map((name) => ({ name })),
          months: [
            { name: 'Sol-Rise', type: 'month', length: 51 },
            { name: 'The Stillness', type: 'month', length: 7 },
          ],
          moons: [{ name: 'Aethel', cycle: 40, offset: 0, faceColor: '#f0f0f0' }],
          eras: [{ format: 'Year {{year}}' }],
        },
        current: { day: 4, month: 0, year: 1379 },
        categories: [{ id: 'rel', name: 'Religious', color: '#FFD700' }],
        events: [
          {
            name: 'Festival of the First Ray',
            date: { day: 1, month: 0, year: [null, null] },
            category: 'rel',
          },
        ],
      },
    ],
  };
  await page.getByLabel('Calendarium data file').setInputFiles({
    name: 'data.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Calendar of the Gradient' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Today' })).toContainText(
    'Main, 4 Sol-Rise, Year 1379',
  );
  await expect(page.getByRole('button', { name: /, 1 Sol-Rise, Year 1379$/ })).toContainText(
    'Festival of the First Ray',
  );
});
