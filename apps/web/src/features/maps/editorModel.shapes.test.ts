import { describe, expect, it } from 'vitest';
import { addItem, newMap } from '../../app/maps/model';
import {
  dedupePoints,
  insertVertex,
  nearestHandle,
  removeVertex,
  snapRiverEnd,
} from './editorModel';

describe('editing the points of a shape or path', () => {
  it('drops points on top of each other (a double click places two)', () => {
    expect(dedupePoints([0, 0, 0.5, 0.2, 10, 10, 10, 10, 30, 0])).toEqual([0, 0, 10, 10, 30, 0]);
  });

  it('finds the handle under the pointer', () => {
    const points = [0, 0, 100, 0, 100, 100];
    expect(nearestHandle(points, { x: 98, y: 3 }, 10)).toBe(1);
    expect(nearestHandle(points, { x: 50, y: 50 }, 10)).toBe(-1);
  });

  it('adds a point on the nearest segment, closed or open, only when close enough', () => {
    const triangle = [0, 0, 100, 0, 50, 80];
    expect(insertVertex(triangle, { x: 50, y: 3 }, true, 10)).toEqual([
      0, 0, 50, 0, 100, 0, 50, 80,
    ]);
    // The closing segment (back to the first point) counts for a closed shape only.
    expect(insertVertex(triangle, { x: 22, y: 42 }, true, 10)?.length).toBe(8);
    expect(insertVertex(triangle, { x: 22, y: 42 }, false, 10)).toBeNull();
    expect(insertVertex(triangle, { x: 500, y: 500 }, true, 10)).toBeNull();
  });

  it('removes a point but keeps enough to draw', () => {
    expect(removeVertex([0, 0, 1, 1, 2, 2, 3, 3], 1, 3)).toEqual([0, 0, 2, 2, 3, 3]);
    expect(removeVertex([0, 0, 1, 1, 2, 2], 1, 3)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('rivers that meet', () => {
  it('end on the river they flow into', () => {
    let doc = newMap('Rivers', [], 'now');
    const layer = doc.layers[0]?.id ?? '';
    doc = addItem(doc, layer, {
      kind: 'path',
      id: 'main',
      points: [0, 100, 400, 100],
      smooth: 0,
      style: 'river',
      width: 40,
      color: '#3d7fb0',
    });
    const joined = snapRiverEnd(doc, [200, 0, 205, 90], 30);
    expect(joined.into).toBe('main');
    expect(joined.points).toEqual([200, 0, 205, 100]);
    expect(snapRiverEnd(doc, [200, 0, 205, 40], 30)).toEqual({ points: [200, 0, 205, 40] });
  });
});
