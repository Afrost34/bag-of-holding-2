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

/** `classFeature` → `Class feature`, `monster` → `Creature`. */
const TYPE_LABELS: Record<string, string> = {
  monster: 'Creature',
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
