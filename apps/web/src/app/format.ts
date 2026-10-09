/** Small display formatters shared across features. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit] ?? 'GB'}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${String(s)} s` : `${String(Math.floor(s / 60))} min ${String(s % 60)} s`;
}

/** `classFeature` → `Class feature`, `monster` → `Monster`. */
const TYPE_LABELS: Record<string, string> = {
  monster: 'Monster',
  baseitem: 'Item (base)',
  magicvariant: 'Magic variant',
  optionalfeature: 'Option',
  race: 'Species',
  subrace: 'Subspecies',
  variantrule: 'Variant rule',
  charoption: 'Character option',
  bookData: 'Book text',
  adventureData: 'Adventure text',
};

export function typeLabel(type: string): string {
  const known = TYPE_LABELS[type];
  if (known) return known;
  const words = type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A bonus with its sign: `+2`, `0` as `+0`, `-1`. */
export const signed = (n: number): string => (n >= 0 ? `+${String(n)}` : String(n));

const SUFFIX = ['th', 'st', 'nd', 'rd'];

/** `1st`, `2nd`, `11th`, `22nd`. */
export function ordinal(n: number): string {
  const v = n % 100;
  return `${String(n)}${SUFFIX[(v - 20) % 10] ?? SUFFIX[v] ?? 'th'}`;
}

/** Every word with a capital letter: `sleight of hand` → `Sleight Of Hand`. */
export const titleWords = (s: string): string =>
  s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** How long ago, in words: "just now", "5 min ago", "yesterday", "3 days ago". */
export function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${String(days)} days ago`;
  return new Date(at).toLocaleDateString();
}
