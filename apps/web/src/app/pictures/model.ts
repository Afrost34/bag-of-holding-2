/**
 * The picture library: pictures the user imported (character portraits, NPC pictures), kept
 * once in the user's data and reused anywhere.
 *
 *   pictures/<name>.webp
 *
 * A character's portrait refers to one as `picture:pictures/<name>.webp` (a reference, never a
 * copy). Older portraits kept inside the character as `data:` URLs still show.
 */

export const PICTURES_DIR = 'pictures';
const REF = 'picture:';

export const pictureRef = (path: string) => `${REF}${path}`;

/** The library path a reference points to, or null for anything else. */
export function picturePathOf(ref: string | undefined): string | null {
  return ref?.startsWith(REF) ? ref.slice(REF.length) : null;
}

/** A file name for the library: the picture's own name, made safe, never one already used. */
export function pictureFileName(original: string, taken: readonly string[], ext: string): string {
  const dot = original.lastIndexOf('.');
  const stem =
    (dot > 0 ? original.slice(0, dot) : original).replace(/[/\\:*?"<>|]/g, '-').trim() || 'picture';
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let name = `${stem}.${ext}`;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem} ${String(n)}.${ext}`;
  return name;
}

/** A `data:` URL as bytes and its file extension (`webp`, `jpeg`, `png`…). */
export function dataUrlBytes(url: string): { bytes: Uint8Array; ext: string } {
  const m = /^data:image\/([a-z+]+);base64,(.*)$/s.exec(url);
  if (!m) throw new Error('Not a picture');
  const bin = atob(m[2] ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = m[1] ?? 'png';
  return { bytes, ext: type === 'jpeg' ? 'jpg' : type.replace('+xml', '') };
}

/** A picture's name as shown: its file name without the extension. */
export const pictureName = (path: string) =>
  (path.split('/').pop() ?? path).replace(/\.[a-z0-9]+$/i, '');
