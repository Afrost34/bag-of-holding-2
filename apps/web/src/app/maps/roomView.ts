import { Container, Graphics, type FillPattern } from 'pixi.js';
import type { MapItem } from './model';
import { roomOutline, type Door } from './rooms';

/**
 * A room drawn in three parts, so rooms that touch join up: all the walls of a layer go under all
 * its floors (the scene puts the walls at the bottom of the layer), a door is cut through a wall
 * by painting floor over it, and the doors themselves (leaf, arch, bars) go over every floor.
 */

type Room = Extract<MapItem, { kind: 'room' }>;

const INK = 0x1f1a15;
const WALL_COLORS = { stone: 0x4a4540, cave: 0x3b3128, wood: 0x5c4026 } as const;

/** How wide a door is: a grid cell's worth for a wall of a usual thickness. */
export const doorWidth = (room: Room): number => Math.max(24, room.wall * 5.5);

/** The walls: a thick line along the outline (the inner half is covered by the floor). */
export function roomWallView(room: Room): Container {
  const g = new Graphics();
  const outline = roomOutline(room.points, room.smooth);
  if (outline.length < 6) return g;
  g.poly(outline).stroke({ color: INK, width: room.wall * 2 + 3, join: 'round' });
  g.poly(outline).stroke({
    color: WALL_COLORS[room.wallStyle],
    width: room.wall * 2,
    join: 'round',
  });
  if (room.wallStyle === 'stone')
    // A lighter edge on the stone, so thick walls read as blocks.
    g.poly(outline).stroke({ color: 0x8a847d, width: room.wall * 0.5, alpha: 0.45, join: 'round' });
  return g;
}

/** The geometry of a door: its length and thickness, and a way to place points along and across. */
function frame(room: Room, door: Door) {
  const w = doorWidth(room);
  const t = room.wall * 2.6;
  const cos = Math.cos(door.angle);
  const sin = Math.sin(door.angle);
  const at = (u: number, v: number): [number, number] => [
    door.x + u * cos - v * sin,
    door.y + u * sin + v * cos,
  ];
  const box = (length: number, thickness: number) => [
    ...at(-length / 2, -thickness / 2),
    ...at(length / 2, -thickness / 2),
    ...at(length / 2, thickness / 2),
    ...at(-length / 2, thickness / 2),
  ];
  return { w, t, at, box };
}

/** The floor, with the walls cut away where there are doors. */
export function roomFloorView(room: Room, pattern: FillPattern | null, color: string): Container {
  const holder = new Container();
  const g = new Graphics();
  const outline = roomOutline(room.points, room.smooth);
  if (outline.length < 6) return holder;
  const fillWith = (target: Graphics) => {
    target.fill(
      pattern ? { fill: pattern } : { color: Number.parseInt(color.replace('#', ''), 16) },
    );
  };
  g.poly(outline);
  fillWith(g);
  g.poly(outline).stroke({
    color: 0x000000,
    width: Math.max(2, room.wall * 0.5),
    alpha: 0.18,
    join: 'round',
  });
  for (const door of room.doors ?? []) {
    const f = frame(room, door);
    g.poly(f.box(f.w, f.t));
    fillWith(g);
  }
  holder.addChild(g);
  return holder;
}

/** The doors: posts, then a leaf, an arch, a portcullis or a hidden one. Over every floor. */
export function roomDoorsView(room: Room): Container {
  const g = new Graphics();
  const wall = WALL_COLORS[room.wallStyle];
  for (const door of room.doors ?? []) {
    const { w, t, at, box } = frame(room, door);
    switch (door.kind) {
      case 'door':
        g.poly(box(w * 0.86, room.wall * 0.7))
          .fill({ color: 0x8a5a2b })
          .stroke({ color: INK, width: 1.4 });
        break;
      case 'portcullis':
        for (let k = -2; k <= 2; k++)
          g.moveTo(...at((k * w) / 5, -t / 3))
            .lineTo(...at((k * w) / 5, t / 3))
            .stroke({ color: 0x55504a, width: 2 });
        break;
      case 'secret':
        // Looks like wall, with a faint mark for whoever made the map.
        g.poly(box(w, t)).fill({ color: wall });
        g.circle(...at(0, 0), room.wall * 0.3).fill({ color: 0xffffff, alpha: 0.5 });
        break;
      case 'arch':
        break;
    }
    // The posts at each side of the opening.
    if (door.kind !== 'secret')
      for (const side of [-1, 1] as const)
        g.circle(...at((side * w) / 2, 0), room.wall * 0.7)
          .fill({ color: wall })
          .stroke({ color: INK, width: 1 });
  }
  return g;
}
