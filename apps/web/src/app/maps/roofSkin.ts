import { Texture } from 'pixi.js';
import { PIXELS_PER_SQUARE } from './packCategories';

/**
 * A roof texture ready to lie on a roof: some of the packs' roof tiles end in a hem (scalloped
 * shingles with transparent pixels below), made to sit on the eave. Stacked row on row, that
 * transparent band would show as gaps, so it is cut off: the hem of one row then meets the top of
 * the next, and the last row ends exactly on the edge of the roof.
 */

export interface RoofSkin {
  /** The texture without its transparent band. */
  texture: Texture;
  /** How tall one tile is on the map, in pixels (its width is `unit` pixels per pack square times its squares). */
  tileHeight: number;
}

/** The share of the picture's height, from the top, that is not empty at its bottom edge (0–1). */
export function opaqueShare(alphaOfRow: (row: number) => number, rows: number): number {
  let last = rows - 1;
  while (last > 0 && alphaOfRow(last) < 0.5) last--;
  return (last + 1) / rows;
}

const skins = new Map<number, Texture>();

/** The texture of a roof, cut at its hem; the picture as it is when it cannot be read. */
function trimmed(texture: Texture): Texture {
  const known = skins.get(texture.uid);
  if (known) return known;
  let result = texture;
  try {
    const source = texture.source.resource as CanvasImageSource | undefined;
    const w = texture.source.pixelWidth;
    const h = texture.source.pixelHeight;
    if (source && typeof OffscreenCanvas !== 'undefined' && w > 0 && h > 0) {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(source, 0, 0);
        const rows = Math.min(h, 200);
        const step = h / rows;
        const alphaOf = (row: number): number => {
          const y = Math.min(h - 1, Math.floor(row * step));
          const data = ctx.getImageData(0, y, w, 1).data;
          let opaque = 0;
          const stride = Math.max(1, Math.floor(w / 64));
          let n = 0;
          for (let x = 0; x < w; x += stride) {
            n++;
            if ((data[x * 4 + 3] ?? 0) > 128) opaque++;
          }
          return n === 0 ? 0 : opaque / n;
        };
        const share = opaqueShare(alphaOf, rows);
        const keep = Math.max(8, Math.round(h * share));
        if (keep < h - 1) {
          const cut = new OffscreenCanvas(w, keep);
          cut.getContext('2d')?.drawImage(canvas, 0, 0, w, keep, 0, 0, w, keep);
          result = Texture.from(cut);
        }
      }
    }
  } catch {
    // Unreadable: the whole picture does.
  }
  skins.set(texture.uid, result);
  return result;
}

/**
 * The roof texture and how tall a tile of it is on a map where one pack square is `unit` pixels
 * (pictures are drawn at 200 pixels to the square).
 */
export function roofSkin(texture: Texture, unit: number): RoofSkin {
  const cut = trimmed(texture);
  return { texture: cut, tileHeight: (cut.source.pixelHeight / PIXELS_PER_SQUARE) * unit };
}
