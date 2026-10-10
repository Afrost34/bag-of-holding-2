import type { MapDoc } from './model';
import { isPackRef } from './packModel';

/** The pictures of imported packs (`pack:<id>:<path>`) a map uses: stamps, scatter and textures. */
export function usedPackRefs(doc: MapDoc): Set<string> {
  const out = new Set<string>();
  const add = (ref: string | undefined) => {
    if (ref && isPackRef(ref)) out.add(ref);
  };
  for (const layer of doc.layers)
    for (const item of layer.items) {
      switch (item.kind) {
        case 'stamp':
          add(item.stamp);
          break;
        case 'stroke':
        case 'shape':
          add(item.texture);
          break;
        case 'wall':
          add(item.texture);
          break;
        case 'room':
          add(item.floor);
          add(item.wallTexture);
          break;
        case 'scatter':
          for (const p of item.pieces) add(p.ref);
          for (const t of item.onlyOn ?? []) add(t);
          break;
      }
    }
  return out;
}
