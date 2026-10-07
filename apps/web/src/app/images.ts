/**
 * 5etools art: originals come from the 5etools image mirror (often 1,500–2,000 px, 300–500 KB);
 * pages ask for a copy sized to how big the image is shown, made by wsrv.nl, a free image
 * resizing CDN (see ADR 0005). Both are cached by the service worker for offline use, and every
 * image falls back to the original if the resized copy fails.
 */

export const IMAGE_BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/';
const RESIZER = 'https://wsrv.nl/';

/** The full-size original of a 5etools image path (`races/XPHB/Elf.webp`). */
export function originalImageUrl(path: string): string {
  return `${IMAGE_BASE}${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** A copy at most `width` pixels wide (never enlarged), as WebP. */
export function resizedImageUrl(path: string, width: number): string {
  const params = new URLSearchParams({
    url: originalImageUrl(path),
    w: String(width),
    output: 'webp',
    q: '78',
  });
  // `we`: without enlargement, so small originals are left as they are.
  return `${RESIZER}?${params.toString()}&we`;
}

/** `srcset` for the given widths. */
export function imageSrcSet(path: string, widths: readonly number[]): string {
  return widths.map((w) => `${resizedImageUrl(path, w)} ${String(w)}w`).join(', ');
}
