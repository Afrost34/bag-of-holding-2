import { describe, expect, it } from 'vitest';
import { FA_ENTRIES } from '../__fixtures__/faNames';
import { newMap, type MapDoc } from '../model';
import { cellsInPolygon } from './cells';
import { dockBerths, planDock } from './dockplan';
import { DOCK_BERTH, addStructure, dockShip, floorsOf, newBuildingSpec } from './structureDoc';

const CELL = 70;
const AREA = [2, 2, 36, 2, 36, 18, 2, 18].map((v) => v * CELL);
const req = { footprint: AREA, cell: CELL, seed: 3, berth: DOCK_BERTH };

function skyDock(): { doc: MapDoc; group: string } {
  const spec = newBuildingSpec(
    {
      archetype: 'sky-dock',
      style: 'sky-dock',
      upper: 0,
      cellar: false,
      rooms: 1,
      windows: false,
      crooked: 0,
    },
    FA_ENTRIES,
    3,
    12,
    { unit: CELL },
  );
  return addStructure(newMap('Rustcrown', [], 'now'), { spec, points: AREA });
}

describe('docks', () => {
  it('are one deck: a spine along the long side and finger piers across', () => {
    const plan = planDock(req);
    expect(plan.rooms).toHaveLength(1);
    expect(plan.rooms[0]?.type).toBe('dock');
    const all = cellsInPolygon(AREA, CELL);
    const deck = new Set(plan.rooms[0]?.cells);
    // The whole first three rows are the spine.
    for (let x = 2; x < 36; x++)
      for (let y = 2; y < 5; y++) expect(deck.has(`${String(x)},${String(y)}`)).toBe(true);
    expect(deck.size).toBeLessThan(all.size);
  });

  it('leave open berths between the fingers, clear of the deck', () => {
    const berths = dockBerths(req);
    expect(berths.length).toBe(3);
    const deck = new Set(planDock(req).rooms[0]?.cells);
    for (const b of berths) {
      expect(b.heading).toBe(180);
      for (const k of cellsInPolygon([b.x0, b.y0, b.x1, b.y0, b.x1, b.y1, b.x0, b.y1], CELL))
        expect(deck.has(k)).toBe(false);
    }
  });

  it('dock a ship in each free berth, then no more', () => {
    let { doc } = skyDock();
    const dock = doc.layers.flatMap((l) => l.items).find((i) => i.kind === 'structure');
    if (dock?.kind !== 'structure') throw new Error('no dock');
    for (let n = 0; n < 3; n++) doc = dockShip(doc, dock, FA_ENTRIES, { unit: CELL }, n + 1);
    const ships = doc.layers
      .flatMap((l) => l.items)
      .filter((i) => i.kind === 'structure' && i.spec.archetype === 'skiff' && i.floor === 0);
    expect(ships).toHaveLength(3);
    for (const s of ships) if (s.kind === 'structure') expect(s.spec.ship?.medium).toBe('sky');
    expect(dockShip(doc, dock, FA_ENTRIES, { unit: CELL }, 9)).toBe(doc);
    expect(floorsOf(doc, dock.group)).toHaveLength(1);
  });
});
