import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { addItem, newMap, type MapDoc, type MapItem } from '../model';
import { dressTables, isSeat, isTable } from './tables';

const TABLE =
  'pack:fa:!Core_Settlements/Furniture/Tables/Rectangle_Tables/Table_Rectangle_Wood_Red_F_2x1.webp';
const CHAIR = 'pack:fa:!Core_Settlements/Furniture/Seating/Chairs/Chair_Wood_Dark_E_1x1.webp';

const stamp = (
  id: string,
  ref: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
): MapItem => ({
  kind: 'stamp',
  id,
  stamp: ref,
  x,
  y,
  w,
  h,
  rotation,
});

function tavern(): MapDoc {
  let doc = newMap('Inn', [], 'now');
  const layer = doc.layers[0]?.id ?? '';
  // A 2 × 1 table with a chair above and one below; a chair far away.
  doc = addItem(doc, layer, stamp('t', TABLE, 300, 300, 140, 70));
  doc = addItem(doc, layer, stamp('c1', CHAIR, 300, 245, 70, 70, 180));
  doc = addItem(doc, layer, stamp('c2', CHAIR, 300, 355, 70, 70));
  doc = addItem(doc, layer, stamp('far', CHAIR, 900, 900, 70, 70));
  return doc;
}

const stamps = (doc: MapDoc) =>
  doc.layers
    .flatMap((l) => l.items)
    .filter((i): i is Extract<MapItem, { kind: 'stamp' }> => i.kind === 'stamp');

describe('dressing tables', () => {
  it('knows tables and seats by their folders', () => {
    const [table, chair] = stamps(tavern());
    expect(table && isTable(table)).toBe(true);
    expect(chair && isSeat(chair)).toBe(true);
    expect(table && isSeat(table)).toBe(false);
  });

  it('sets a place on the table for each chair beside it, and something in the middle', () => {
    const doc = dressTables(tavern(), ['t'], FA_ENTRIES, 4);
    const added = stamps(doc).slice(4);
    expect(added).toHaveLength(3);
    // Settings on the table's edge towards each chair, the middle piece at its centre.
    const ys = added.map((s) => s.y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(300);
    expect(ys[2]).toBeGreaterThan(300);
    expect(added.every((s) => Math.abs(s.x - 300) < 1 || s.y === 300)).toBe(true);
    expect(added.every((s) => s.stamp.startsWith('pack:fa:'))).toBe(true);
    expect(new Set(stamps(doc).map((s) => s.id)).size).toBe(stamps(doc).length);
  });

  it('leaves what is not a table alone, and does nothing without pictures', () => {
    const doc = tavern();
    expect(dressTables(doc, ['c1'], FA_ENTRIES, 1)).toBe(doc);
    expect(dressTables(doc, ['t'], [], 1)).toBe(doc);
  });
});
