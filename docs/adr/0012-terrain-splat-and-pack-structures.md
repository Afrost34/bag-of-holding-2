# 0012 - Terrain splat, pack-driven structures, no map type

Status: accepted (supersedes the "battle / world" kinds of ADR 0010)

## Context

The owner asked for the Creator to work like Dungeondraft (research in `docs/research/`): a map is only a
size, every tool is always there, the grid is shown or hidden, terrain is painted with a soft brush in
texture slots, and walls, doors and floors come from the imported Forgotten Adventures packs.

## Decisions

- **No map type.** `MapDoc.kind` is gone (old files keep opening: it is ignored). A map has a size in squares
  (`newMap(name, ids, now, {w, h})`, default 40 x 30, at most 200 x 200, 70 px a square). `Grid.visible`
  hides the grid; hidden, it still snaps and measures. Old world maps (`grid.type: 'none'`) read as hidden.
- **Terrain is a stroke log, not a raster file.** `MapDoc.splat = { slots: TerrainRef[] (max 8), strokes }`.
  `splatView.ts` rebuilds soft masks from the strokes (one canvas per slot, at most 2048 px a side) and
  shows each slot as a tiled texture seen through its mask. Painting a slot rubs the others off under the
  brush; the slot Fill covered the map with stays under everything and is never rubbed off, so edges blend
  without gaps. Masks must be painted white: Pixi multiplies by the mask's red channel. Chosen over a raster
  file beside the JSON because undo, sync, moving a map and the flat render then need nothing new.
- **Textures are `TerrainRef`**: a built-in terrain id or `pack:<id>:<path>`. Terrain shapes, roads, room floors
  and splat slots all take either. A pack picture spans 5 squares.
- **Walls from packs use the `..._Straight_Path` strip** (one square tall, seamless): `wallStrip.ts` lays one
  `TilingSprite` per segment, stretched by half the thickness so corners meet. Walls and rooms carry an
  optional `texture` / `wallTexture`. Doors and windows of a pack (`.../Doors/`, `.../Windows/`) snap onto the
  nearest wall and turn along it (`portal.ts`).
- Items can be drawn under the other items of their layer (`under`), and copied, cut, pasted and ordered.
- Export can be a Universal VTT file (`uvtt.ts`): the picture plus walls and doors in squares.
