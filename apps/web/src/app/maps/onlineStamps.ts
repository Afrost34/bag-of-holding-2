/**
 * Stamp packs found online: downloaded once when the DM asks (then kept by the browser for use
 * offline), searched, and the icons the DM picks are added to their own stamp library as
 * pictures. Nothing is fetched until the DM opens a pack.
 */

export interface OnlinePack {
  id: string;
  name: string;
  /** What is in it, in a few words. */
  about: string;
  /** An Iconify icon set (one JSON file of SVG bodies). */
  url: string;
  /** Roughly, for the download button. */
  size: string;
  license: string;
  licenseUrl: string;
  /** Shown with the pack and kept with each stamp (the licence asks for it). */
  credit: string;
  /** The library folder its stamps go in. */
  folder: string;
}

export const ONLINE_PACKS: OnlinePack[] = [
  {
    id: 'game-icons',
    name: 'Game-icons.net',
    about:
      'Over 4,000 symbols: castles, trees, monsters, weapons, furniture, ships… for world, city and battle maps.',
    url: 'https://cdn.jsdelivr.net/npm/@iconify-json/game-icons@1.2.4/icons.json',
    size: '6 MB',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    credit: 'Icons by Lorc, Delapouite and the other game-icons.net artists (game-icons.net)',
    folder: 'Game icons',
  },
];

export interface IconSet {
  /** Icon name → SVG body (paths). */
  icons: Record<string, { body: string }>;
  width: number;
  height: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** An Iconify JSON file's icons; aliases are left out (they repeat other icons). */
export function parseIconSet(json: unknown): IconSet {
  if (!isObj(json) || !isObj(json.icons)) throw new Error('This is not an icon set');
  const icons: Record<string, { body: string }> = {};
  for (const [name, icon] of Object.entries(json.icons))
    if (isObj(icon) && typeof icon.body === 'string') icons[name] = { body: icon.body };
  return {
    icons,
    width: typeof json.width === 'number' ? json.width : 512,
    height: typeof json.height === 'number' ? json.height : 512,
  };
}

/** `castle-ruins` → `castle ruins`. */
export const iconLabel = (name: string) => name.replace(/-/g, ' ');

/** Icon names matching every word of a search, shortest names (closest matches) first. */
export function findIcons(set: IconSet, query: string, limit = 120): string[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const names = Object.keys(set.icons).filter((n) => words.every((w) => n.includes(w)));
  if (words.length) names.sort((a, b) => a.length - b.length || a.localeCompare(b, 'en'));
  return names.slice(0, limit);
}

/**
 * An icon as a standalone SVG in a colour, with an optional outline in a second colour so it
 * stands out on any ground.
 */
export function iconSvg(set: IconSet, name: string, color: string, outline?: string): string {
  const body = set.icons[name]?.body ?? '';
  const view = `0 0 ${String(set.width)} ${String(set.height)}`;
  const halo = outline
    ? `<g fill="${outline}" stroke="${outline}" stroke-width="${String(set.width / 24)}" stroke-linejoin="round" color="${outline}">${body}</g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${String(set.width)}" height="${String(set.height)}">${halo}<g color="${color}" fill="${color}">${body}</g></svg>`;
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const CACHE = 'boh-stamp-packs';
const sets = new Map<string, Promise<IconSet>>();

/** Whether a pack was downloaded before (so opening it needs no connection). */
export async function packDownloaded(pack: OnlinePack): Promise<boolean> {
  try {
    return (await (await caches.open(CACHE)).match(pack.url)) !== undefined;
  } catch {
    return false;
  }
}

/** A pack's icons: from the browser's cache when downloaded before, else downloaded now. */
export function loadPack(pack: OnlinePack): Promise<IconSet> {
  let set = sets.get(pack.id);
  if (!set) {
    set = (async () => {
      // No cache where the browser has none (private windows): the pack is then downloaded each time.
      const cache = 'caches' in globalThis ? await caches.open(CACHE).catch(() => null) : null;
      let response = cache ? await cache.match(pack.url) : undefined;
      if (!response) {
        const fresh = await fetch(pack.url);
        if (!fresh.ok) throw new Error(`Could not download ${pack.name} (${String(fresh.status)})`);
        await cache?.put(pack.url, fresh.clone());
        response = fresh;
      }
      return parseIconSet(await response.json());
    })();
    set.catch(() => sets.delete(pack.id));
    sets.set(pack.id, set);
  }
  return set;
}

/** An SVG drawn as a PNG `size` pixels square (map stamps are pictures). */
export async function svgToPng(svg: string, size = 256): Promise<Uint8Array> {
  const img = new Image();
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pictures cannot be drawn on this device');
  ctx.drawImage(img, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('Could not make the picture');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Colours a stamp can be made in: ink, white, and earthy map colours; each with an outline. */
export const STAMP_STYLES = [
  { id: 'ink', name: 'Ink', color: '#2b2420', outline: '#ffffff' },
  { id: 'white', name: 'White', color: '#ffffff', outline: '#2b2420' },
  { id: 'red', name: 'Red', color: '#a12a1f', outline: '#ffffff' },
  { id: 'green', name: 'Green', color: '#2f5d1e', outline: '#ffffff' },
  { id: 'blue', name: 'Blue', color: '#1f4e79', outline: '#ffffff' },
  { id: 'brown', name: 'Brown', color: '#6b4423', outline: '#f3ead6' },
] as const;
