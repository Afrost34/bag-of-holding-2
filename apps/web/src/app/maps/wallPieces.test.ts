import { describe, expect, it } from 'vitest';
import { junctionPieces, piecesFor, placePieces, type WallPieces } from './wallPieces';

describe('the pieces of a wall set', () => {
  const files = [
    'Wall_Stone_Earthy_B1_Straight_Path.webp',
    'Wall_Stone_Earthy_B1_Corner_A_1x1.webp',
    'Wall_Stone_Earthy_B1_Corner_F_2x2.webp',
    'Wall_Stone_Earthy_B1_Corner_H_3x3.webp',
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
      roundCorner: {
        file: 'Wall_Stone_Earthy_B1_Corner_F_2x2.webp',
        squares: 2,
        arms: [0, 90],
        reach: 1,
      },
      wideCorner: {
        file: 'Wall_Stone_Earthy_B1_Corner_H_3x3.webp',
        squares: 3,
        arms: [0, 90],
        pivot: [1 / 3, 1 / 3],
        reach: 2,
      },
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
    // A turn that is almost straight takes no piece.
    expect(
      placePieces([0, 0, 100, 0, 200, 10], false, STONE).filter((p) => p.kind === 'corner'),
    ).toEqual([]);
  });

  it('turns the nearest piece to the bisector at another angle', () => {
    // East then a 60-degree turn: an inside angle of 120, nearest a right angle: a corner turned to share the bisector.
    const out = placePieces([0, 0, 100, 0, 150, 87], false, STONE).find((p) => p.kind === 'corner');
    expect(out).toMatchObject({ x: 100, y: 0 });
    // Arms at 180 (back) and 60 (on): the bisector points at 120; the corner's own bisector is 45.
    expect(out?.rotation).toBe(75);
  });

  it('uses the rounded corner of a stone set when asked, and its diagonal connector at 45', () => {
    const set: WallPieces = {
      corner: { file: 'c', squares: 1, arms: [0, 90] },
      roundCorner: { file: 'r', squares: 2, arms: [0, 90] },
      diagonal: { file: 'd', squares: 1, arms: [0, 135] },
    };
    const turn = [0, 0, 100, 0, 100, 100];
    expect(placePieces(turn, false, set, 'round').find((p) => p.x === 100)?.kind).toBe(
      'roundCorner',
    );
    expect(placePieces(turn, false, set, 'sharp').find((p) => p.x === 100)?.kind).toBe('corner');
    // East then north-east: the inside angle is 135.
    expect(placePieces([-100, 0, 0, 0, 70, -70], false, set).find((p) => p.x === 0)?.kind).toBe(
      'diagonal',
    );
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

describe('the wide rounded corner', () => {
  it('is chosen by the wide style and falls back on the rounded one', () => {
    const wide: WallPieces = {
      roundCorner: { file: 'r', squares: 2, arms: [0, 90] },
      wideCorner: { file: 'w', squares: 3, arms: [0, 90], pivot: [1 / 3, 1 / 3] },
    };
    const turn = [0, 0, 100, 0, 100, 100];
    expect(placePieces(turn, false, wide, 'wide').find((p) => p.x === 100)?.kind).toBe(
      'wideCorner',
    );
    expect(placePieces(turn, false, wide, 'round').find((p) => p.x === 100)?.kind).toBe(
      'roundCorner',
    );
    const noWide: WallPieces = { roundCorner: { file: 'r', squares: 2, arms: [0, 90] } };
    expect(placePieces(turn, false, noWide, 'wide').find((p) => p.x === 100)?.kind).toBe(
      'roundCorner',
    );
  });
});

describe('metal sets', () => {
  it('a metal wall strip without Straight_ has its pieces like a stone set', () => {
    const files = [
      'Wall_Metal_Gray_F_Path.webp',
      'Wall_Metal_Gray_F_Corner_A_1x1.webp',
      'Wall_Metal_Gray_F_Corner_F_2x2.webp',
      'Wall_Metal_Gray_F_Ending_A_1x1.webp',
      'Wall_Metal_Gray_F_Joint_B_1x1.webp',
      'Wall_Metal_Rusty_F_Corner_A_1x1.webp',
    ];
    const set = piecesFor('Wall_Metal_Gray_F_Path.webp', files);
    expect(set.corner).toEqual({
      file: 'Wall_Metal_Gray_F_Corner_A_1x1.webp',
      squares: 1,
      arms: [0, 90],
    });
    expect(set.ending?.file).toBe('Wall_Metal_Gray_F_Ending_A_1x1.webp');
    expect(set.roundCorner?.squares).toBe(2);
    expect(set.tee).toBe('Wall_Metal_Gray_F_Joint_B_1x1.webp');
  });

  it('the garden metal corner is a single square with arms east and south', () => {
    const files = [
      'Botanical_Garden_Wall_Metal_Gray_A1_Path.webp',
      'Botanical_Garden_Wall_Metal_Gray_Corner_A1_1x1.webp',
      'Botanical_Garden_Wall_Metal_Gray_Corner_B1_1x1.webp',
    ];
    expect(piecesFor('Botanical_Garden_Wall_Metal_Gray_A1_Path.webp', files)).toEqual({
      corner: {
        file: 'Botanical_Garden_Wall_Metal_Gray_Corner_A1_1x1.webp',
        squares: 1,
        arms: [0, 90],
      },
    });
  });
});

describe('other wall families', () => {
  it('a brick set has its corner with arms west and north, its End and its Diagonal', () => {
    const files = [
      'Wall_Brick_Earthy_C_Straight_Path.webp',
      'Wall_Brick_Earthy_C_Corner_A_1x1.webp',
      'Wall_Brick_Earthy_C_End_A_1x1.webp',
      'Wall_Brick_Earthy_C_Diagonal_A_1x1.webp',
      'Wall_Brick_Earthy_C_Joint_B_1x1.webp',
    ];
    const set = piecesFor('Wall_Brick_Earthy_C_Straight_Path.webp', files);
    expect(set.corner).toMatchObject({ arms: [180, 270] });
    expect(set.ending).toMatchObject({ file: 'Wall_Brick_Earthy_C_End_A_1x1.webp', arms: [180] });
    expect(set.diagonal).toMatchObject({ arms: [180, 315] });
    expect(set.tee).toBeUndefined();
  });

  it('a dwarven set finds its pieces by the strip letter', () => {
    const files = [
      'Dwarven_Wall_Stone_Earthy_F_Path.webp',
      'Dwarven_Wall_Stone_Earthy_Corner_F1_1x1.webp',
      'Dwarven_Wall_Stone_Earthy_Ending_F1_1x1.webp',
      'Dwarven_Wall_Stone_Earthy_Diagonal_F1_1x1.webp',
    ];
    const set = piecesFor('Dwarven_Wall_Stone_Earthy_F_Path.webp', files);
    expect(set.corner?.file).toBe('Dwarven_Wall_Stone_Earthy_Corner_F1_1x1.webp');
    expect(set.ending).toMatchObject({ arms: [180], shift: 0.25 });
    expect(set.diagonal?.file).toBe('Dwarven_Wall_Stone_Earthy_Diagonal_F1_1x1.webp');
  });

  it('a set with outer and inner corners uses the outer one on open walls and where a loop turns out', () => {
    const files = [
      'Wall_StoneWood_Earthy_Dark_C_Straight_Path.webp',
      'Wall_StoneWood_Earthy_Dark_C_Corner_Out_A_1x1.webp',
      'Wall_StoneWood_Earthy_Dark_C_Corner_In_A_1x1.webp',
      'Wall_StoneWood_Earthy_Dark_C_Ending_A_1x1.webp',
    ];
    const set = piecesFor('Wall_StoneWood_Earthy_Dark_C_Straight_Path.webp', files);
    expect(set.corner?.file).toContain('Corner_Out_A');
    expect(set.cornerIn?.file).toContain('Corner_In_A');
    // An L-shaped room: five convex corners and one concave one.
    const room = [0, 0, 200, 0, 200, 100, 100, 100, 100, 200, 0, 200];
    const kinds = placePieces(room, true, set).map((p) => p.kind);
    expect(kinds.filter((k) => k === 'corner')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'cornerIn')).toHaveLength(1);
    // The same walls reversed give the same counts (the winding does not matter).
    const reversed = placePieces([...room].reverse(), true, set).map((p) => p.kind);
    expect(reversed.filter((k) => k === 'cornerIn')).toHaveLength(1);
  });
});

describe('Ceremorph walls', () => {
  it('get their ending, drawn with the wall to the east', () => {
    const files = [
      'Ceremorph_Wall_Blue_G_Path.webp',
      'Ceremorph_Wall_Blue_Ending_G1_1x1.webp',
      'Ceremorph_Wall_Blue_Corner_G1_1x1.webp',
    ];
    const set = piecesFor('Ceremorph_Wall_Blue_G_Path.webp', files);
    expect(set).toEqual({
      ending: {
        file: 'Ceremorph_Wall_Blue_Ending_G1_1x1.webp',
        squares: 1,
        arms: [0],
        shift: 0.275,
      },
    });
  });
});

describe('Drow walls', () => {
  it('find their corner and ending by the colour and letter of the strip', () => {
    const files = [
      'Drow_Wall_Stone_Earthy_F_Metal_Gray_Path.webp',
      'Drow_Wall_Stone_Earthy_Corner_Metal_Gray_F_1x1.webp',
      'Drow_Wall_Stone_Earthy_Ending_Metal_Gray_F1_1x1.webp',
      'Drow_Wall_Stone_Earthy_Ending_Metal_Gray_F2_1x1.webp',
      'Drow_Wall_Stone_Earthy_Corner_Metal_Polished_F_1x1.webp',
    ];
    const set = piecesFor('Drow_Wall_Stone_Earthy_F_Metal_Gray_Path.webp', files);
    expect(set.corner).toEqual({
      file: 'Drow_Wall_Stone_Earthy_Corner_Metal_Gray_F_1x1.webp',
      squares: 1,
      arms: [180, 270],
    });
    expect(set.ending?.file).toBe('Drow_Wall_Stone_Earthy_Ending_Metal_Gray_F1_1x1.webp');
  });
});
