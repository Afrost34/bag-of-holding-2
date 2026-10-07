/** Longest side of pictures kept in user data (packs, portraits): big enough, small enough to sync. */
const MAX_SIDE = 800;

/**
 * A picture file shrunk to at most 800 px and encoded as a data URL (WebP, or JPEG where WebP
 * cannot be written), so it lives inside the pack and travels with it.
 */
export async function shrinkImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pictures cannot be read on this device');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', 0.82);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}
