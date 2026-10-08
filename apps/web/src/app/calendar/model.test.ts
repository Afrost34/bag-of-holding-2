import { describe, expect, it } from 'vitest';
import {
  addDays,
  addEvent,
  addMonths,
  eventsOn,
  formatDate,
  fromCalendarium,
  gameDateValue,
  monthWeeks,
  moonPhase,
  newCalendar,
  parseCalendar,
  parseGameDate,
  seasonOf,
  serializeCalendar,
  upcoming,
  weekdayOf,
  type Calendar,
} from './model';

/** The Calendar of the Gradient, as Calendarium keeps it (trimmed). */
const calendarium = {
  calendars: [
    {
      name: 'Calendar of the Gradient',
      description: 'The calendar of Heliark.',
      static: {
        firstWeekDay: 0,
        overflow: false,
        weekdays: ['Char', 'Igni', 'Flux', 'Main', 'Mid', 'Flo', 'Hom', 'Flec', 'Vo', 'Sun'].map(
          (name) => ({ name }),
        ),
        months: [
          ...['Sol-Rise', 'Kindle-Moon', 'Iron-Hold', 'Twin-Light', 'Ash-Fall', 'Deep-Anchor'].map(
            (name) => ({ name, type: 'month', length: 51 }),
          ),
          ...['Veil-Drift', 'Green-Wind', 'Free-Sky'].map((name) => ({
            name,
            type: 'month',
            length: 51,
          })),
          { name: 'The Stillness', type: 'month', length: 7 },
        ],
        moons: [
          { name: 'Aethel', cycle: 40, offset: 0, faceColor: '#f0f0f0' },
          { name: 'Cinder', cycle: 14, offset: 0, faceColor: '#8b0000' },
        ],
        eras: [{ name: 'Post-Cataclysm', format: 'Year {{year}}' }],
      },
      seasonal: {
        seasons: [
          { name: 'High Burn', duration: 102, color: '#FF4500' },
          { name: 'The Wane', duration: 102, color: '#DAA520' },
          { name: 'Low Hum', duration: 153, color: '#708090' },
          { name: 'The Wax', duration: 109, color: '#2E8B57' },
        ],
      },
      current: { day: 4, month: 7, year: 1379 },
      categories: [{ id: 'rel', name: 'Religious', color: '#FFD700' }],
      events: [
        {
          name: 'Festival of the First Ray',
          date: { day: 1, month: 0, year: [null, null] },
          category: 'rel',
          note: null,
        },
        {
          name: "Session 1: Dargo's Briefing",
          date: { day: 4, month: 7, year: 1379 },
          note: '08_Adventures_and_Sessions/Act_I_Timeline.md',
        },
      ],
    },
  ],
};

const gradient = (): Calendar => {
  const cal = fromCalendarium(calendarium, (p) =>
    p.includes('Act_I') ? 'Adventures/Act I.md' : null,
  );
  if (!cal) throw new Error('not converted');
  return cal;
};

describe('calendar', () => {
  it('reads a Calendarium calendar', () => {
    const cal = gradient();
    expect(cal.months).toHaveLength(10);
    expect(cal.weekdays).toHaveLength(10);
    expect(cal.today).toEqual({ year: 1379, month: 7, day: 4 });
    expect(cal.yearFormat).toBe('Year {year}');
    expect(cal.events[0]?.date).toEqual({ month: 0, day: 1 });
    expect(cal.events[1]).toMatchObject({ date: { year: 1379 }, note: 'Adventures/Act I.md' });
    expect(formatDate(cal, cal.today)).toBe('Main, 4 Green-Wind, Year 1379');
  });

  it('counts days across months and years', () => {
    const cal = gradient();
    expect(addDays(cal, { year: 1379, month: 9, day: 7 }, 1)).toEqual({
      year: 1380,
      month: 0,
      day: 1,
    });
    expect(addDays(cal, { year: 1380, month: 0, day: 1 }, -1)).toEqual({
      year: 1379,
      month: 9,
      day: 7,
    });
    expect(addMonths(cal, { year: 1379, month: 8, day: 30 }, 1)).toEqual({
      year: 1379,
      month: 9,
      day: 7,
    });
  });

  it('starts every month on the first weekday unless weeks run on', () => {
    const cal = gradient();
    expect(weekdayOf(cal, { year: 1379, month: 3, day: 1 })).toBe(0);
    expect(monthWeeks(cal, 1379, 9)).toEqual([[1, 2, 3, 4, 5, 6, 7, null, null, null]]);
    const running = { ...newCalendar('Plain'), overflow: true };
    // 30-day months and 7-day weeks: month 2 starts 2 weekdays later.
    expect(weekdayOf(running, { year: 0, month: 1, day: 1 })).toBe(2);
    expect(monthWeeks(running, 0, 1)[0]?.slice(0, 3)).toEqual([null, null, 1]);
  });

  it('follows moons, seasons and events', () => {
    const cal = gradient();
    const aethel = cal.moons[0];
    if (!aethel) throw new Error('no moon');
    expect(moonPhase(cal, aethel, { year: 0, month: 0, day: 1 })).toBe(0);
    expect(moonPhase(cal, aethel, { year: 0, month: 0, day: 21 })).toBe(4);
    expect(seasonOf(cal, { year: 5, month: 2, day: 1 })?.name).toBe('The Wane');
    expect(eventsOn(cal, { year: 1400, month: 0, day: 1 }).map((e) => e.name)).toEqual([
      'Festival of the First Ray',
    ]);
    expect(eventsOn(cal, { year: 1380, month: 7, day: 4 })).toHaveLength(0);
    const later = addEvent(cal, {
      name: 'Siege',
      date: { year: 1379, month: 7, day: 10 },
      end: { year: 1379, month: 7, day: 12 },
    });
    expect(eventsOn(later, { year: 1379, month: 7, day: 11 }).map((e) => e.name)).toEqual([
      'Siege',
    ]);
    expect(upcoming(later, cal.today, 10).map((u) => u.event.name)).toEqual([
      "Session 1: Dargo's Briefing",
      'Siege',
    ]);
  });

  it('writes and reads back; notes carry their day as a property', () => {
    const cal = gradient();
    expect(parseCalendar(serializeCalendar(cal))).toEqual(cal);
    expect(gameDateValue({ year: 1379, month: 7, day: 4 })).toBe('1379-08-04');
    expect(parseGameDate('1379-08-04')).toEqual({ year: 1379, month: 7, day: 4 });
    expect(parseGameDate('soon')).toBeNull();
  });
});
