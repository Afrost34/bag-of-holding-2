/**
 * Note templates, as in Obsidian's core Templates plugin: `{{title}}`, `{{date}}`, `{{time}}`,
 * and `{{date:dddd D MMMM YYYY}}` / `{{time:HH:mm}}` with a format.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Formats a date with Moment-style tokens (the ones Obsidian users write in templates). */
export function formatDate(date: Date, format: string): string {
  const tokens: Record<string, () => string> = {
    YYYY: () => String(date.getFullYear()),
    YY: () => pad(date.getFullYear() % 100),
    MMMM: () => MONTHS[date.getMonth()] ?? '',
    MMM: () => (MONTHS[date.getMonth()] ?? '').slice(0, 3),
    MM: () => pad(date.getMonth() + 1),
    M: () => String(date.getMonth() + 1),
    dddd: () => DAYS[date.getDay()] ?? '',
    ddd: () => (DAYS[date.getDay()] ?? '').slice(0, 3),
    DD: () => pad(date.getDate()),
    D: () => String(date.getDate()),
    HH: () => pad(date.getHours()),
    H: () => String(date.getHours()),
    mm: () => pad(date.getMinutes()),
    ss: () => pad(date.getSeconds()),
  };
  // `[text]` is literal, as in Moment.
  return format.replace(
    /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|mm|ss/g,
    (match, literal: string | undefined) => literal ?? tokens[match]?.() ?? match,
  );
}

export function applyTemplate(template: string, vars: { title: string; now: Date }): string {
  return template.replace(
    /\{\{\s*(title|date|time)\s*(?::([^}]*))?\}\}/gi,
    (_, name: string, format: string | undefined) => {
      const key = name.toLowerCase();
      if (key === 'title') return vars.title;
      // An empty format (`{{date:}}`) means the default one.
      const given = format?.trim();
      const fallback = key === 'date' ? 'YYYY-MM-DD' : 'HH:mm';
      return formatDate(vars.now, given === undefined || given === '' ? fallback : given);
    },
  );
}

/** Notes that can be used as templates: those in a folder whose name contains "template". */
export function templatePaths(paths: readonly string[]): string[] {
  return paths.filter((p) => {
    const folders = p.split('/').slice(0, -1);
    return /\.md$/i.test(p) && folders.some((f) => /template/i.test(f));
  });
}
