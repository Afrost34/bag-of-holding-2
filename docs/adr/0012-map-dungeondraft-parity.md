# 0012 — Maps follow Dungeondraft's tools and interface; terrain stays vector

Date: 2026-10-10 · Status: accepted

## Context

The owner wants every Dungeondraft tool in the map Creator, laid out and used the way Dungeondraft's are,
plus more for world maps. `docs/research/dungeondraft.md` lists what Dungeondraft does and where our
JSON-item map format differs. VTT export (`.dd2vtt`) was asked for and then dropped: it is not wanted.

## Decision

- **Terrain stays vector.** Dungeondraft paints a raster splat map; we keep brush strokes as items with a
  texture and a `soft` edge (a blur proportional to the stroke's width). No binary file sits beside the
  map, sync and undo stay as they are, and a stroke can still be picked, moved and erased.
- **Light is one canvas picture** drawn over the layers (`drawLighting` in `scene.ts`): the ambient colour,
  each light as a radial gradient clipped to its visibility polygon (`lighting.ts`: walls, room outlines
  shut at doors and open at archways, buildings, stamps marked "blocks light"). With an ambient colour the
  picture multiplies the map; without one it only adds a glow. It is rebuilt only when lights, walls or the
  ambient change, at most about 2k pixels wide, and part of `artHash` so the flat render stays current.
- **Edit points and the usual keys work on every drawn item**: walls, routes, shapes, paths, rooms,
  buildings and districts show handles; Backspace takes the last point back while drawing, Delete over a
  point removes it, Alt erases with a brush, `[` `]` size brushes. Doors of a room keep their wall and
  their place along it when the room's corners move (`reattachDoors`).
- **The interface follows Dungeondraft's**: tools in headed groups (Move, Terrain, Design, Objects,
  Effects, Notes, Play), a bar under the map with grid, snap (with half, quarter and eighth steps), roofs,
  the selected item, a hint for the tool and the square under the pointer, and a hotbar of the stamps
  used last (keys 1–9, kept per device).
- **Map-level look is data on the map**: ambient light, sun direction and shade, hidden roofs, compass
  rose and frame, contour lines of the elevation. Each is optional and absent means "as before".
- **World-map extras**: rivers that run downhill from the elevation, contour lines, regions (a plain
  colour with a dashed border and a label along it), compass and frame.

## Consequences

- A map made with the new options opens in older builds as plain art (unknown fields are dropped, a
  `light` item is ignored); nothing breaks.
- Lights darken pins too; the Viewer's pins are drawn in the layers, under the lighting.
- Not done, and recorded in the research file: levels with a compare overlay, merging overlapping rooms
  into one outline, holes in districts, a tag index from `.dungeondraft_tags`.
