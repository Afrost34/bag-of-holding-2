import type { MapDoc } from './model';
import { isPackRef } from './packModel';
import { kitRefs } from './kits/kitDoc';
import { paletteRefs } from './structure/structureDoc';

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
          for (const rule of item.rules) for (const p of rule.pieces) add(p.ref);
          for (const t of item.onlyOn ?? []) add(t);
          break;
        case 'structure':
          for (const ref of paletteRefs(item.spec)) add(ref);
          break;
        case 'kit':
          for (const ref of kitRefs(item)) add(ref);
          break;
      }
    }
  return out;
}
