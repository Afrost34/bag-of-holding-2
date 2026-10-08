/**
 * A campaign's own calendar: its weekdays, months, moons and seasons, the in-game "today", and
 * the events that happen on its days (once, or every year). Notes are pinned to a day by their
 * `in_game_date` property. Pure functions; the store writes `campaigns/<c>/calendar.json`.
 */

export const CALENDAR_FILE = 'calendar.json';
/** The note property that pins a note (a session, a battle, a birth) to a day. */
export const DATE_PROPERTY = 'in_game_date';

export interface CalendarDate {
  year: number;
  /** 0-based index into `months`. */
  month: number;
  /** 1-based. */
  day: number;
}

export interface CalendarMonth {
  name: string;
  days: number;
  /** A festival month outside the week (its days have no weekday). */
  intercalary?: boolean;
}

export interface Moon {
  name: string;
  /** Days from new moon to new moon. */
  cycle: number;
  /** Days into its cycle on day 1 of year 0. */
  offset: number;
  color: string;
}

export interface Season {
  name: string;
  /** How many days it lasts; seasons follow each other from the first day of the year. */
  days: number;
  color: string;
}

export interface EventCategory {
  id: string;
  name: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  name: string;
  description?: string;
  /** No year: every year on that day. */
  date: { year?: number; month: number; day: number };
  /** Last day, for an event lasting several days. */
  end?: CalendarDate;
  category?: string;
  /** A journal note about it (path). */
  note?: string;
  /** Kept from the players (not shown in the player window). */
  secret?: boolean;
}

export interface Calendar {
  version: 1;
  name: string;
  description?: string;
  weekdays: string[];
  months: CalendarMonth[];
  moons: Moon[];
  seasons: Season[];
  categories: EventCategory[];
  events: CalendarEvent[];
  /** The in-game date now. */
  today: CalendarDate;
  /** How a year is written; `{year}` is replaced. */
  yearFormat: string;
  /** Weeks run on across months; otherwise every month starts on the first weekday. */
  overflow: boolean;
  /** The weekday of day 1 of year 0 (with `overflow`). */
  firstWeekday: number;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** A plain calendar to start from: twelve months of 30 days, seven weekdays, one moon. */
export function newCalendar(name: string): Calendar {
  const months = [
    'Deepwinter', 'Claw of Winter', 'Claw of Sunsets', 'Claw of Storms', 'Melting', 'Time of Flowers',
    'Summertide', 'Highsun', 'Fading', 'Leaffall', 'Rotting', 'Drawing Down',
  ]; // prettier-ignore
  return {
    version: 1,
    name,
    weekdays: [
      'First-day',
      'Second-day',
      'Third-day',
      'Fourth-day',
      'Fifth-day',
      'Sixth-day',
      'Seventh-day',
    ],
    months: months.map((m) => ({ name: m, days: 30 })),
    moons: [{ name: 'Moon', cycle: 30, offset: 0, color: '#e5e7eb' }],
    seasons: [],
    categories: [{ id: 'events', name: 'Events', color: '#b91c1c' }],
    events: [],
    today: { year: 1, month: 0, day: 1 },
    yearFormat: 'Year {year}',
    overflow: true,
    firstWeekday: 0,
  };
}

export function daysInYear(cal: Calendar): number {
  return cal.months.reduce((n, m) => n + m.days, 0);
}

/** Days before `month` in a year. */
function monthStart(cal: Calendar, month: number): number {
  return cal.months.slice(0, month).reduce((n, m) => n + m.days, 0);
}

/** 0-based day of the year. */
export function dayOfYear(cal: Calendar, date: CalendarDate): number {
  return monthStart(cal, date.month) + date.day - 1;
}

/** Days since day 1 of year 0 (negative before). */
export function dayNumber(cal: Calendar, date: CalendarDate): number {
  return date.year * daysInYear(cal) + dayOfYear(cal, date);
}

export function fromDayNumber(cal: Calendar, n: number): CalendarDate {
  const length = daysInYear(cal);
  const year = Math.floor(n / length);
  let rest = n - year * length;
  for (let month = 0; month < cal.months.length; month++) {
    const days = cal.months[month]?.days ?? 0;
    if (rest < days) return { year, month, day: rest + 1 };
    rest -= days;
  }
  return { year, month: cal.months.length - 1, day: cal.months.at(-1)?.days ?? 1 };
}

export function addDays(cal: Calendar, date: CalendarDate, days: number): CalendarDate {
  return fromDayNumber(cal, dayNumber(cal, date) + days);
}

/** The same day `months` months later (clamped to the month's length). */
export function addMonths(cal: Calendar, date: CalendarDate, months: number): CalendarDate {
  const index = date.year * cal.months.length + date.month + months;
  const year = Math.floor(index / cal.months.length);
  const month = mod(index, cal.months.length);
  return { year, month, day: Math.min(date.day, cal.months[month]?.days ?? 1) };
}

export const sameDay = (a: CalendarDate, b: CalendarDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/** Index into `weekdays`, or null on an intercalary day. */
export function weekdayOf(cal: Calendar, date: CalendarDate): number | null {
  const week = cal.weekdays.length;
  if (week === 0 || cal.months[date.month]?.intercalary) return null;
  if (!cal.overflow) return mod(date.day - 1, week);
  // Intercalary days do not count in the week.
  let n = dayNumber(cal, date);
  const festival = cal.months.reduce((s, m) => s + (m.intercalary ? m.days : 0), 0);
  const before = cal.months
    .slice(0, date.month)
    .reduce((s, m) => s + (m.intercalary ? m.days : 0), 0);
  n -= date.year * festival + before;
  return mod(n + cal.firstWeekday, week);
}

/** A month as weeks of days (null: an empty cell before the first day or after the last). */
export function monthWeeks(cal: Calendar, year: number, month: number): (number | null)[][] {
  const length = cal.months[month]?.days ?? 0;
  const week = Math.max(1, cal.weekdays.length);
  if (cal.months[month]?.intercalary) {
    const rows: (number | null)[][] = [];
    for (let d = 1; d <= length; d += week)
      rows.push(Array.from({ length: week }, (_, i) => (d + i <= length ? d + i : null)));
    return rows;
  }
  const first = weekdayOf(cal, { year, month, day: 1 }) ?? 0;
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];
  while (cells.length % week) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += week) rows.push(cells.slice(i, i + week));
  return rows;
}

export const MOON_PHASES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

/** 0 new … 4 full … 7 waning crescent. */
export function moonPhase(cal: Calendar, moon: Moon, date: CalendarDate): number {
  if (moon.cycle <= 0) return 0;
  const position = mod(dayNumber(cal, date) + moon.offset, moon.cycle) / moon.cycle;
  return Math.round(position * 8) % 8;
}

export function seasonOf(cal: Calendar, date: CalendarDate): Season | null {
  const total = cal.seasons.reduce((n, s) => n + s.days, 0);
  if (total <= 0) return null;
  let rest = mod(dayOfYear(cal, date), total);
  for (const s of cal.seasons) {
    if (rest < s.days) return s;
    rest -= s.days;
  }
  return null;
}

/** Whether an event falls on a day (every year, once, or across several days). */
export function happensOn(cal: Calendar, event: CalendarEvent, date: CalendarDate): boolean {
  const year = event.date.year ?? date.year;
  const start = dayNumber(cal, { year, month: event.date.month, day: event.date.day });
  const end = event.end
    ? dayNumber(cal, event.date.year === undefined ? { ...event.end, year } : event.end)
    : start;
  const n = dayNumber(cal, date);
  return n >= start && n <= Math.max(start, end);
}

export function eventsOn(cal: Calendar, date: CalendarDate): CalendarEvent[] {
  return cal.events.filter((e) => happensOn(cal, e, date));
}

/** The events of the next `days` days from `from` (today included), soonest first. */
export function upcoming(
  cal: Calendar,
  from: CalendarDate,
  days: number,
): { date: CalendarDate; event: CalendarEvent }[] {
  const out: { date: CalendarDate; event: CalendarEvent }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(cal, from, i);
    for (const event of eventsOn(cal, date))
      if (!out.some((o) => o.event.id === event.id)) out.push({ date, event });
  }
  return out;
}

export function formatYear(cal: Calendar, year: number): string {
  return cal.yearFormat.replace('{year}', String(year));
}

/** "Char, 4 Veil-Drift, Year 1379" */
export function formatDate(cal: Calendar, date: CalendarDate, weekday = true): string {
  const w = weekdayOf(cal, date);
  const day = `${String(date.day)} ${cal.months[date.month]?.name ?? '?'}`;
  return `${weekday && w !== null ? `${cal.weekdays[w] ?? ''}, ` : ''}${day}, ${formatYear(cal, date.year)}`;
}

/** The value of a note's `in_game_date` property: `1379-08-04` (month counted from 1). */
export function gameDateValue(date: CalendarDate): string {
  return `${String(date.year)}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function parseGameDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const m = /^(-?\d+)-(\d+)-(\d+)$/.exec(String(value).trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

// region Changes

const eventId = (cal: Calendar) => {
  let i = cal.events.length + 1;
  while (cal.events.some((e) => e.id === `e${String(i)}`)) i++;
  return `e${String(i)}`;
};

export function addEvent(cal: Calendar, event: Omit<CalendarEvent, 'id'>): Calendar {
  return { ...cal, events: [...cal.events, { ...event, id: eventId(cal) }] };
}

export function updateEvent(cal: Calendar, id: string, event: Omit<CalendarEvent, 'id'>): Calendar {
  return { ...cal, events: cal.events.map((e) => (e.id === id ? { ...event, id } : e)) };
}

export function removeEvent(cal: Calendar, id: string): Calendar {
  return { ...cal, events: cal.events.filter((e) => e.id !== id) };
}

export function setToday(cal: Calendar, today: CalendarDate): Calendar {
  return { ...cal, today };
}

// endregion

// region Files

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function parseDate(v: unknown, fallback: CalendarDate): CalendarDate {
  if (!isObj(v)) return fallback;
  return { year: num(v.year, fallback.year), month: num(v.month, 0), day: num(v.day, 1) };
}

export function parseCalendar(text: string | null): Calendar | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(json)) return null;
  const months = list(json.months)
    .filter(isObj)
    .map((m) => ({
      name: str(m.name, 'Month'),
      days: Math.max(1, num(m.days, 30)),
      ...(m.intercalary === true ? { intercalary: true } : {}),
    }));
  if (months.length === 0) return null;
  return {
    version: 1,
    name: str(json.name, 'Calendar'),
    ...(typeof json.description === 'string' ? { description: json.description } : {}),
    weekdays: list(json.weekdays).filter((w): w is string => typeof w === 'string'),
    months,
    moons: list(json.moons)
      .filter(isObj)
      .map((m) => ({
        name: str(m.name, 'Moon'),
        cycle: num(m.cycle, 30),
        offset: num(m.offset, 0),
        color: str(m.color, '#e5e7eb'),
      })),
    seasons: list(json.seasons)
      .filter(isObj)
      .map((s) => ({
        name: str(s.name, 'Season'),
        days: num(s.days, 90),
        color: str(s.color, '#6b7280'),
      })),
    categories: list(json.categories)
      .filter(isObj)
      .map((c) => ({ id: str(c.id), name: str(c.name), color: str(c.color, '#6b7280') })),
    events: list(json.events)
      .filter(isObj)
      .filter((e) => typeof e.id === 'string' && typeof e.name === 'string' && isObj(e.date))
      .map((e) => e as unknown as CalendarEvent),
    today: parseDate(json.today, { year: 1, month: 0, day: 1 }),
    yearFormat: str(json.yearFormat, 'Year {year}'),
    overflow: json.overflow !== false,
    firstWeekday: num(json.firstWeekday, 0),
  };
}

export function serializeCalendar(cal: Calendar): string {
  return `${JSON.stringify(cal, null, 2)}\n`;
}

// endregion

// region Calendarium

/**
 * A calendar from the Calendarium plugin for Obsidian (its `data.json`, or one calendar of it).
 * `notePath` maps the vault path of an event's note to the journal's.
 */
export function fromCalendarium(
  json: unknown,
  notePath: (vaultPath: string) => string | null = () => null,
): Calendar | null {
  const root: unknown =
    isObj(json) && Array.isArray(json.calendars) ? (json.calendars as unknown[])[0] : json;
  if (!isObj(root) || !isObj(root.static)) return null;
  const st = root.static;
  const months = list(st.months)
    .filter(isObj)
    .map((m) => ({
      name: str(m.name, 'Month'),
      days: Math.max(1, num(m.length, 30)),
      ...(m.type === 'intercalary' ? { intercalary: true } : {}),
    }));
  if (months.length === 0) return null;
  const era = list(st.eras).find(isObj);
  const seasonal = isObj(root.seasonal) ? list(root.seasonal.seasons) : [];
  const current = isObj(root.current) ? root.current : {};
  const events: CalendarEvent[] = [];
  for (const e of list(root.events).filter(isObj)) {
    const d = isObj(e.date) ? e.date : {};
    const year: unknown = Array.isArray(d.year) ? (d.year as unknown[])[0] : d.year;
    const note = typeof e.note === 'string' ? notePath(e.note) : null;
    events.push({
      id: `e${String(events.length + 1)}`,
      name: str(e.name, 'Event'),
      ...(typeof e.description === 'string' && e.description ? { description: e.description } : {}),
      date: {
        ...(typeof year === 'number' ? { year } : {}),
        month: num(d.month, 0),
        day: num(d.day, 1),
      },
      ...(typeof e.category === 'string' ? { category: e.category } : {}),
      ...(note ? { note } : {}),
    });
  }
  return {
    version: 1,
    name: str(root.name, 'Calendar'),
    ...(typeof root.description === 'string' ? { description: root.description } : {}),
    weekdays: list(st.weekdays)
      .filter(isObj)
      .map((w) => str(w.name)),
    months,
    moons: list(st.moons)
      .filter(isObj)
      .map((m) => ({
        name: str(m.name, 'Moon'),
        cycle: num(m.cycle, 30),
        offset: num(m.offset, 0),
        color: str(m.faceColor, '#e5e7eb'),
      })),
    seasons: seasonal.filter(isObj).map((s) => ({
      name: str(s.name, 'Season'),
      days: num(s.duration, 90),
      color: str(s.color, '#6b7280'),
    })),
    categories: list(root.categories)
      .filter(isObj)
      .map((c) => ({ id: str(c.id), name: str(c.name), color: str(c.color, '#6b7280') })),
    events,
    today: {
      year: num(current.year, 1),
      month: num(current.month, 0),
      day: num(current.day, 1),
    },
    yearFormat: isObj(era)
      ? str(era.format, 'Year {{year}}').replace('{{year}}', '{year}')
      : 'Year {year}',
    overflow: st.overflow !== false,
    firstWeekday: num(st.firstWeekDay, 0),
  };
}

// endregion
