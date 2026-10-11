import { layerShown, type MapDoc, type MapItem } from './model';
import { parsePackRef } from './packModel';
import { scatterOf } from './scatterDoc';
import { expandStructures, roofedOver } from './structure/structureDoc';
import { stampUnit } from './units';

/**
 * Pictures that give light (a candle, a lit brazier, a campfire, a wall lamp) light the map by
 * themselves: no light item to place and keep in step. The light comes from the picture's folder
 * (Forgotten Adventures' `Lightsources/…`), a stamp can turn it off or change it (`light`), and
 * the pieces of a dressing glow too (candles in a shrine's corners). Pure.
 */

/** A light as a picture gives it: its reach in pack squares, colour and strength (0–1). */
export interface Glow {
  squares: number;
  color: string;
  intensity: number;
}

/** A light on the map, as `drawLighting` paints it. */
export interface MapLight {
  x: number;
  y: number;
  /** Map pixels. */
  range: number;
  color: string;
  intensity: number;
  shadows: boolean;
}

const WARM = '#ffcf8a';
const FIRE = '#ff9a4a';

/**
 * The light of a pack picture, from its path; null for pictures that give none. Torches, braziers
 * and forges give light only when lit (`Lit` in the folder or name); parts, mounts and fallen
 * lanterns give none.
 */
export function sourceGlow(path: string): Glow | null {
  const p = path.toLowerCase();
  if (/\/(parts|mounts)\/|_empty|fallen|_off_|snuffer|candle_wax/.test(p)) return null;
  const lit = /\/lit\/|_lit[_.]/.test(p);
  if (p.includes('/forges/')) return lit ? { squares: 4, color: FIRE, intensity: 0.8 } : null;
  if (!p.includes('/lightsources/')) return null;
  if (p.includes('/braziers/')) return lit ? { squares: 6, color: FIRE, intensity: 0.85 } : null;
  if (p.includes('/torches_and_sconces/'))
    return lit || p.includes('/outdoor_torch/')
      ? { squares: 5, color: '#ffb060', intensity: 0.8 }
      : null;
  if (p.includes('/chandeliers/')) return { squares: 7, color: WARM, intensity: 0.9 };
  if (p.includes('/lamp_posts/')) return { squares: 6, color: '#ffe0a8', intensity: 0.85 };
  if (p.includes('/lamps/') || p.includes('/interior_wall_lights/'))
    return { squares: 4, color: '#ffd9a0', intensity: 0.8 };
  if (p.includes('/lanterns/')) return { squares: 4, color: '#ffc979', intensity: 0.8 };
  if (p.includes('/candelabras/')) return { squares: 3.5, color: WARM, intensity: 0.75 };
  if (p.includes('/candles/')) return { squares: 2.5, color: WARM, intensity: 0.65 };
  if (p.includes('/campfires_and_firepits/')) return { squares: 7, color: FIRE, intensity: 0.9 };
  if (p.includes('/pyres/')) return { squares: 8, color: FIRE, intensity: 0.95 };
  if (p.includes('/coals_hot/')) return { squares: 2, color: '#ff6a2a', intensity: 0.6 };
  return null;
}

/** Lights looked up so far, by picture (a map of a thousand stamps asks for each on every change). */
const glowCache = new Map<string, Glow | null>();

/** The light a picture reference gives (glyphs and pictures of one's own give none). */
export function refGlow(ref: string): Glow | null {
  const known = glowCache.get(ref);
  if (known !== undefined) return known;
  const parsed = parsePackRef(ref);
  const glow = parsed ? sourceGlow(parsed.path) : null;
  glowCache.set(ref, glow);
  return glow;
}

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

/** A stamp's light: its own, the one its picture gives, or none (`light: false`). */
export function stampGlow(stamp: Stamp): Glow | null {
  if (stamp.light === false) return null;
  return stamp.light ?? refGlow(stamp.stamp);
}

/** Lights that reach this far (squares) cast shadows from walls; smaller ones are only a glow. */
const SHADOW_SQUARES = 4;

const fromGlow = (x: number, y: number, glow: Glow, unit: number): MapLight => ({
  x,
  y,
  range: glow.squares * unit,
  color: glow.color,
  intensity: glow.intensity,
  shadows: glow.squares >= SHADOW_SQUARES,
});

/** Every light on the layers shown: light items, glowing stamps and glowing dressing pieces. */
export function mapLights(doc: MapDoc): MapLight[] {
  const unit = stampUnit(doc);
  const out: MapLight[] = [];
  for (const layer of doc.layers) {
    if (!layerShown(doc, layer) || layer.picture) continue;
    // A building's lamps and hearths light it too, unless its roof is on.
    const open = layer.items.filter((i) => i.kind !== 'structure' || !roofedOver(doc, i));
    for (const item of expandStructures(doc, open)) {
      if (item.kind === 'light')
        out.push({
          x: item.x,
          y: item.y,
          range: item.range,
          color: item.color,
          intensity: item.intensity,
          shadows: item.shadows,
        });
      else if (item.kind === 'stamp') {
        const glow = stampGlow(item);
        if (glow) out.push(fromGlow(item.x, item.y, glow, unit));
      } else if (item.kind === 'scatter') {
        const glows = item.rules.map((r) => r.pieces.map((p) => refGlow(p.ref)));
        if (!glows.some((list) => list.some(Boolean))) continue;
        for (const inst of scatterOf(doc, item)) {
          const glow = glows[inst.rule]?.[inst.piece];
          if (glow) out.push(fromGlow(inst.x, inst.y, glow, unit));
        }
      }
    }
  }
  return out;
}
