import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { addItem, newMap, type MapDoc, type MapItem } from '../model';
import { nearestOnPolyline } from '../spline';
import { stampUnit } from '../units';
import { expandStructures } from '../structure/structureDoc';
import { KITS, kitById } from './catalog';
import { bakeKit, kitLine, kitParts, makeKit, resolveKit, type KitItem } from './kitDoc';

const LINE = [100, 100, 800, 100, 800, 500];

function withKit(kit: string, entries = FA_ENTRIES, loop = false): { doc: MapDoc; item: KitItem } {
  const base = newMap('Platform', [], 'now');
  const item = makeKit('k1', kit, LINE, entries, { loop });
  const layer = base.layers[0];
  if (!layer) throw new Error('no layer');
  return { doc: addItem(base, layer.id, item), item };
}

const pathsOf = (items: readonly MapItem[]) =>
  items.filter((i): i is Extract<MapItem, { kind: 'path' }> => i.kind === 'path');
const stampsOf = (items: readonly MapItem[]) =>
  items.filter((i): i is Extract<MapItem, { kind: 'stamp' }> => i.kind === 'stamp');

describe('line kits', () => {
  it('pick every picture they ask for from the real packs', () => {
    for (const kit of KITS) {
      const p = resolveKit(kit, FA_ENTRIES);
      if (kit.deck) expect(p.deck, kit.id).toMatch(/_Path\.webp$/);
      if (kit.rail) expect(p.rail, kit.id).toMatch(/_Path\.webp$/);
      if (kit.post) expect(p.post, kit.id).toBeDefined();
    }
    const chainwalk = resolveKit(kitById('chainwalk'), FA_ENTRIES);
    expect(chainwalk.deck).toContain('Floor_Grate_Line_Metal_Rusty');
    expect(chainwalk.rail).toContain('Torment_Chain_A_Path');
    expect(resolveKit(kitById('pipe'), FA_ENTRIES).post).toContain('Flange_Metal_Rusty_Large');
  });

  it('draw a deck down the line and a rail to each side, as wide as the kit says', () => {
    const { doc, item } = withKit('chainwalk');
    const parts = kitParts(doc, item);
    const unit = stampUnit(doc);
    const [deck, left, right] = pathsOf(parts);
    expect(deck?.id).toBe('k1~deck');
    expect(deck?.width).toBe(Math.round(unit));
    expect(deck?.texture).toContain('Floor_Grate_Line');
    const line = kitLine(item);
    for (const rail of [left, right]) {
      expect(rail?.texture).toContain('Torment_Chain');
      // The rail runs half a square and a bit from the middle line (its corners mitred further out).
      const off: number[] = [];
      for (let i = 0; i + 1 < (rail?.points.length ?? 0); i += 2)
        off.push(
          nearestOnPolyline(line, { x: rail?.points[i] ?? 0, y: rail?.points[i + 1] ?? 0 }).dist,
        );
      off.sort((a, b) => a - b);
      expect(off[Math.floor(off.length / 2)]).toBeCloseTo(0.55 * unit, 0);
    }
  });

  it('stands posts to both sides, evenly from end to end', () => {
    const { doc, item } = withKit('chainwalk');
    const posts = stampsOf(kitParts(doc, item));
    const unit = stampUnit(doc);
    // 700 + 400 pixels at a post every 3 squares, two sides.
    const along = Math.floor(1100 / (3 * unit)) + 1;
    expect(posts).toHaveLength(along * 2);
    expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length);
    expect(posts[0]?.stamp).toContain('Pillar_Metal');
  });

  it('puts a pipe’s flanges on its line, across it', () => {
    const { doc, item } = withKit('pipe');
    const flanges = stampsOf(kitParts(doc, item));
    expect(flanges.length).toBeGreaterThan(2);
    const line = kitLine(item);
    for (const f of flanges) expect(nearestOnPolyline(line, f).dist).toBeLessThan(1);
    // Along the first, horizontal, stretch the flange is not turned.
    const r = flanges[0]?.rotation ?? 90;
    expect(Math.min(r, 360 - r)).toBeLessThanOrEqual(2);
  });

  it('is drawn without packs (coloured lines, no posts)', () => {
    const { doc, item } = withKit('scaffold', []);
    const parts = kitParts(doc, item);
    expect(pathsOf(parts)).toHaveLength(3);
    expect(pathsOf(parts).every((p) => p.texture === undefined)).toBe(true);
    expect(stampsOf(parts)).toHaveLength(0);
  });

  it('is drawn as its parts on the layer, and baked into them', () => {
    const { doc, item } = withKit('cable-bridge');
    const layer = doc.layers[0];
    const drawn = expandStructures(doc, layer?.items ?? []);
    expect(drawn.some((i) => i.kind === 'kit')).toBe(false);
    expect(drawn.length).toBe(kitParts(doc, item).length);
    const baked = bakeKit(doc, 'k1');
    const items = baked.layers.flatMap((l) => l.items);
    expect(items.some((i) => i.kind === 'kit')).toBe(false);
    expect(items).toHaveLength(kitParts(doc, item).length);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('closes into a loop: no post doubled where the ends meet', () => {
    const { doc, item } = withKit('chainwalk', FA_ENTRIES, true);
    const parts = kitParts(doc, item);
    expect(pathsOf(parts).every((p) => p.loop === true)).toBe(true);
    const posts = stampsOf(parts).filter((p) => p.id.endsWith('l'));
    const keys = posts.map((p) => `${String(Math.round(p.x / 5))},${String(Math.round(p.y / 5))}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
