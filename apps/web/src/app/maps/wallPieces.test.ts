import { describe, expect, it } from 'vitest';
import { junctionPieces, piecesFor, placePieces, type WallPieces } from './wallPieces';

describe('the pieces of a wall set', () => {
  const files = [
    'Wall_Stone_Earthy_B1_Straight_Path.webp',
    'Wall_Stone_Earthy_B1_Corner_A_1x1.webp',
    'Wall_Stone_Earthy_B1_Corner_F_2x2.webp',
    'Wall_Stone_Earthy_B1_Ending_A_1x1.webp',
    'Wall_Stone_Earthy_B1_Joint_A_1x1.webp',
    'Wall_Stone_Earthy_B1_Joint_B_1x1.webp',
    'Wall_Stone_Earthy_B2_Corner_A_1x1.webp',
    'Shack_Wall_Wood_A_Ashen_A1_Path.webp',
    'Shack_Wall_Wood_A_Ashen_A2_Path.webp',
    'Shack_Wall_Wood_A_Ashen_Corner_A1_2x2.webp',
    'Shack_Wall_Wood_A_Ashen_Corner_A2_2x2.webp',
    'Shack_Wall_Wood_A_Ashen_Diagonal_A1_2x2.webp',
    'Shack_Wall_Wood_A_Ashen_End_A1_1x1.webp',
    'Shack_Wall_Wood_A_Ashen_Railing_A1_Path.webp',
  ];

  it('finds the corner, ending and joints of a stone set, and nothing of another', () => {
    expect(piecesFor(files[0] ?? '', files)).toEqual({
      corner: { file: 'Wall_Stone_Earthy_B1_Corner_A_1x1.webp', squares: 1, arms: [0, 90] },
      ending: { file: 'Wall_Stone_Earthy_B1_Ending_A_1x1.webp', squares: 1, arms: [0] },
      tee: 'Wall_Stone_Earthy_B1_Joint_B_1x1.webp',
      cross: 'Wall_Stone_Earthy_B1_Joint_A_1x1.webp',
    });
  });

  it('finds the corner, diagonal and end of a wood set by its variant', () => {
    expect(piecesFor('Shack_Wall_Wood_A_Ashen_A1_Path.webp', files)).toEqual({
      corner: { file: 'Shack_Wall_Wood_A_Ashen_Corner_A1_2x2.webp', squares: 2, arms: [270, 0] },
      diagonal: {
        file: 'Shack_Wall_Wood_A_Ashen_Diagonal_A1_2x2.webp',
        squares: 2,
        arms: [180, 315],
      },
      ending: {
        file: 'Shack_Wall_Wood_A_Ashen_End_A1_1x1.webp',
        squares: 1,
        arms: [180],
        shift: 0.2,
      },
    });
    // A railing has no pieces of its own.
    expect(piecesFor('Shack_Wall_Wood_A_Ashen_Railing_A1_Path.webp', files)).toEqual({});
  });
});

const STONE: WallPieces = {
  corner: { file: 'c', squares: 1, arms: [0, 90] },
  ending: { file: 'e', squares: 1, arms: [0] },
};
const WOOD: WallPieces = {
  corner: { file: 'c', squares: 2, arms: [270, 0] },
  diagonal: { file: 'd', squares: 2, arms: [180, 315] },
  ending: { file: 'e', squares: 1, arms: [180], shift: 0.2 },
};

describe('where pieces stand on a wall', () => {
  it('puts corners at right angles, turned so the arms meet the wall', () => {
    const [e1, c, e2] = placePieces([0, 0, 100, 0, 100, 100], false, STONE);
    expect(c).toMatchObject({ kind: 'corner', x: 100, y: 0, rotation: 90 });
    expect(e1).toMatchObject({ kind: 'ending', x: 0, y: 0, rotation: 0 });
    expect(e2).toMatchObject({ kind: 'ending', x: 100, y: 100, rotation: 270 });
  });

  it('turns each of the four corners of a stone set', () => {
    const corner = (pts: number[]) =>
      placePieces(pts, false, STONE).find((p) => p.kind === 'corner')?.rotation;
    expect(corner([0, 100, 0, 0, 100, 0])).toBe(0);
    expect(corner([0, 0, 100, 0, 100, 100])).toBe(90);
    expect(corner([100, 0, 100, 100, 0, 100])).toBe(180);
    expect(corner([0, 0, 0, 100, 100, 100])).toBe(270);
  });

  it('turns the corners and ends of a wood set by where its arms are drawn', () => {
    const corner = (pts: number[]) =>
      placePieces(pts, false, WOOD).find((p) => p.kind === 'corner')?.rotation;
    // Arms north and east as drawn: coming from the north going east.
    expect(corner([0, -100, 0, 0, 100, 0])).toBe(0);
    expect(corner([0, 0, 100, 0, 100, 100])).toBe(180);
    const [end] = placePieces([0, 0, 100, 0], false, WOOD);
    // The end's wall runs west as drawn: a wall going east from here turns it half a circle.
    expect(end).toMatchObject({ kind: 'ending', rotation: 180, along: { x: 1, y: 0 } });
  });

  it('puts a diagonal where a wall turns by 45 degrees, and nothing where it turns otherwise', () => {
    // West arm and a north-east arm as drawn: a wall coming from the west going north-east.
    const out = placePieces([-100, 0, 0, 0, 70, -70], false, WOOD);
    expect(out.find((p) => p.kind === 'diagonal')).toMatchObject({ x: 0, y: 0, rotation: 0 });
    expect(
      placePieces([0, 0, 100, 0, 150, 60], false, STONE).filter((p) => p.kind === 'corner'),
    ).toEqual([]);
  });

  it('closes a loop without endings', () => {
    const loop = placePieces([0, 0, 100, 0, 100, 100, 0, 100], true, STONE);
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
