import { userStore } from '../userStore';
import { saveThumbnail } from './assets';
import { artHash, mapRenderPath, setActiveVariant, type MapDoc, type MapRender } from './model';
import { MapScene } from './scene';

/**
 * The flat picture of a map's art (see `MapRender`): drawn on a hidden canvas, once for each
 * variant, as WebP no wider than `MAX_SIDE`. Devices without the stamp packs show it instead of
 * drawing the art. Made by the Creator a few seconds after the art last changed.
 */

const MAX_SIDE = 4096;

async function toWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Could not make the picture'));
      },
      'image/webp',
      0.85,
    );
  });
}

/** Draws the art of `doc` (no pins, routes or fog) and keeps it with the map's assets. */
export async function bakeMap(doc: MapDoc): Promise<MapRender> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:64px;height:64px;overflow:hidden';
  document.body.appendChild(host);
  const scene = new MapScene();
  scene.hideAnnotations = true;
  try {
    await scene.init(host);
    const scale = Math.min(1, MAX_SIDE / Math.max(doc.width, doc.height));
    const keys = doc.variants?.length ? doc.variants.map((v) => v.id) : ['-'];
    const store = await userStore();
    const images: Record<string, string> = {};
    let first: Blob | null = null;
    for (const key of keys) {
      const variantDoc = key === '-' ? doc : setActiveVariant(doc, key);
      scene.setDoc(variantDoc);
      await scene.settled();
      const blob = await toWebp(scene.exportCanvas({ withGrid: false, scale }));
      first ??= blob;
      const path = mapRenderPath(doc.id, key, doc.campaign);
      await store.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      images[key] = path;
    }
    // Pictures of variants that no longer exist go.
    for (const old of Object.values(doc.render?.images ?? {}))
      if (!Object.values(images).includes(old)) await store.remove(old).catch(() => undefined);
    // The maps list shows the first one small, so a map with no picture layer has a thumbnail.
    if (first) await saveThumbnail(first, doc.id, doc.campaign);
    return {
      hash: artHash(doc),
      width: Math.max(1, Math.round(doc.width * scale)),
      height: Math.max(1, Math.round(doc.height * scale)),
      images,
    };
  } finally {
    scene.destroy();
    host.remove();
  }
}
