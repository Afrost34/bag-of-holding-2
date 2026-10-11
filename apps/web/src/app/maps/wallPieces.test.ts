import { describe, expect, it } from 'vitest';
import { junctionPieces, piecesFor, placePieces } from './wallPieces';

describe('the pieces of a wall set', () => {
  const files = [
    'Wall_Stone_Earthy_B1_Straight_Path.webp',
    'Wall_Stone_Earthy_B1_Corner_A_1x1.webp',
    'Wall_Stone_Earthy_B1_Corner_F_2x2.webp',
    'Wall_Stone_Earthy_B1_Ending_A_1x1.webp',
    'Wall_Stone_Earthy_B2_Corner_A_1x1.webp',
  ];

  it('finds the corner and the ending of the same set, and nothing of another', () => {
    expect(piecesFor(files[0] ?? '', files)).toEqual({
      corner: 'Wall_Stone_Earthy_B1_Corner_A_1x1.webp',
      ending: 'Wall_Stone_Earthy_B1_Ending_A_1x1.webp',
    });
    expect(piecesFor('Shack_Wall_Wood_Ashen_A1_Path.webp', files)).toEqual({});
  });
});

describe('where pieces stand on a wall', () => {
  it('puts corners at right angles, turned so the arms meet the wall', () => {
    // East then south: the arms point west (back) and south (on): turn 90 so east/south become south/west.
    const [e1, c, e2] = placePieces([0, 0, 100, 0, 100, 100], false);
    expect(c).toMatchObject({ kind: 'corner', x: 100, y: 0 });
    expect(e1).toMatchObject({ kind: 'ending', x: 0, y: 0, rotation: 0 });
    expect(e2).toMatchObject({ kind: 'ending', x: 100, y: 100, rotation: -90 });
    // Arms west (2) and south (1): the picture's east/south turned by 90 gives south/west.
    expect(c?.rotation).toBe(90);
  });

  it('turns each of the four corners', () => {
    const corner = (pts: number[]) =>
      placePieces(pts, false).find((p) => p.kind === 'corner')?.rotation;
    // Arms east and south as drawn: coming from the south going east.
    expect(corner([0, 100, 0, 0, 100, 0])).toBe(0);
    expect(corner([100, 0, 0, 0, 0, 100])).toBe(0);
    // Arms south and west.
    expect(corner([0, 0, 100, 0, 100, 100])).toBe(90);
    // Arms west and north.
    expect(corner([100, 0, 100, 100, 0, 100])).toBe(180);
    // Arms north and east.
    expect(corner([0, 0, 0, 100, 100, 100])).toBe(270);
  });

  it('skips a turn that is not a right angle, and closes a loop without endings', () => {
    expect(placePieces([0, 0, 100, 0, 150, 60], false).filter((p) => p.kind === 'corner')).toEqual(
      [],
    );
    const loop = placePieces([0, 0, 100, 0, 100, 100, 0, 100], true);
    expect(loop.filter((p) => p.kind === 'ending')).toHaveLength(0);
    expect(loop.filter((p) => p.kind === 'corner')).toHaveLength(4);
  });
});

describe('where walls meet', () => {
  it('puts a T where one wall ends on another, turned so the stem points the way it goes', () => {
    // A wall along the top, another ending in the middle of it from below: arms W, E and S.
    const j = junctionPieces([
      { id: 'a', points: [0, 0, 200, 0], closed: false },
      { id: 'b', points: [100, 0, 100, 100], closed: false },
    ]);
    const mine = j.get('a');
    expect(mine).toHaveLength(1);
    expect(mine?.[0]).toMatchObject({ kind: 'tee', x: 100, y: 0, rotation: 0 });
    // From above: the missing arm is south, so the piece turns half a circle.
    const up = junctionPieces([
      { id: 'a', points: [0, 0, 200, 0], closed: false },
      { id: 'b', points: [100, 0, 100, -100], closed: false },
    ]);
    expect(up.get('a')?.[0]).toMatchObject({ kind: 'tee', rotation: 180 });
  });

  it('puts a cross where two walls run through each other, and nothing for a single wall', () => {
    const cross = junctionPieces([
      { id: 'a', points: [0, 0, 200, 0], closed: false },
      { id: 'b', points: [100, -100, 100, 100], closed: false },
    ]);
    expect([...cross.values()].flat().some((p) => p.kind === 'cross')).toBe(true);
    expect(
      junctionPieces([{ id: 'a', points: [0, 0, 100, 0, 100, 100], closed: false }]).size,
    ).toBe(0);
  });
});
