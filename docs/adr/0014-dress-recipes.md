# 0014 — Scatter becomes Dress: dressings are lists of rules made from recipes

Date: 2026-10-11 · Status: accepted

## Context

The owner wants game-engine style set-dressing tools (a forest with undergrowth at its edge, a
furnished room, decay, a market) built from the Forgotten Adventures packs. A scatter item held a
single rule: one set of pictures, one spacing, area or line. Each new tool would have needed an item
kind of its own. The owner also asked for scatter snap, a size for each picture, standing on roads,
and falloff. The full tool list is in `docs/research/procedural-tools.md`.

## Decision

- **A dressing is a scatter item with `rules`.** The file kind stays `scatter`, so old maps load.
  `parseMap` moves an old item's flat settings into one rule (`dress/upgrade.ts`). The first rule
  uses the item's seed, so old maps look exactly as before.
- **A rule (`DressRule` in `model.ts`)** holds:
  - pictures with a weight and their own size (`scale`);
  - `place`: area, along, edge, cluster or grid, or, in a room (`dress/interior.ts`): back to the
    walls, in the corners, down the middle, round an earlier rule's pieces (`anchor`), on them, or a
    place setting in front of each seat;
  - spacing and sizes, rotation, falloff, snap, flip, tint variation, and `apart` (keep clear of
    earlier rules).

  The engine (`dress/engine.ts`, pure) runs the rules in order. Each rule's pieces are drawn back to
  front, after the rules before it (shadows first, then trees).

- **Recipes are data** (`dress/recipes.ts`). A recipe rule names the pack pictures it wants as a
  `Wanted` query, and glyphs to stand in while no pack is imported (ADR 0013). `recipeRules` picks
  the pictures once: the **palette is a snapshot**, so importing more packs later does not change a
  map. **Pick again** re-picks a rule from its recipe (`from: "recipe:rule"`), and **Roll again**
  changes the seed. The old glyph presets, pack presets and furnish presets are all recipes now.
- **The tool is called Dress** in the UI (key X). It shows recipe cards in groups, "size of
  everything", one piece per click, and placement options (only on, keep clear, stand on roads too).
  The full rules sit behind "Advanced". A dressing can be drawn, tied to a shape, room or road, or
  made from a pack folder ("Dress with these").
- **Room changes reach dressings**: `obstacleSignature` now covers rooms, so furniture follows a room
  that is reshaped.
- **Furniture knows the room.** Pieces are turned rectangles that never overlap, except seats tucked
  under their table, pieces on top of their anchor, and rugs (`floor`). They keep about a square
  clear of every doorway (the room's doors and pack door pictures on its walls). Middle pieces keep
  a square and a half from the walls, and wall pieces keep half a square from what stands in the
  room, so there is always a way from each door to the middle (`walkable`, tested for every room
  type). Forgotten Adventures furniture faces down, so "back to the wall" turns the top of the
  picture to the wall.
- **Room types are recipes** (`dress/interiors.ts`): tavern and inn, homes and shops, martial and
  civic, arcane and holy, plus a smithy. Glyphs stand in only when no pack is imported or drawn art
  is on, so a room from the packs never mixes drawn tables with pack chairs.

- **Relations outdoors** (added later): `ring` stands pieces round each piece of an earlier rule,
  evenly from a random start, facing it when turned `along` (seats and bedrolls round a camp's
  fires, standing stones round an altar); `front` puts one piece before each, turned as it is (a
  grave before its tombstone, wares before a stall). A ring or front piece always belongs to its
  nearest anchor, so it never crowds a neighbouring fire or the next row. `count` on a scattered
  rule keeps the pieces nearest the middle (one altar in the circle).
- **The ground drives the art** (added later): a rule can keep to a `height` band (0 the shore, 1
  the map's highest ground) and a `slope` band (0 flat, 1 a cliff, `dress/ground.ts`). Pieces thin
  out across the soft ends of a band. Without elevation the bands do nothing. Dressings that use a
  band are made again when the elevation changes (only those: painting hills does not remake every
  forest).

## Consequences

- New set-dressing tools are mostly new recipes and new placements, not new item kinds.
- Tests check that recipes resolve on real FA names (`__fixtures__/faNames.ts`). Add real names
  there when a recipe asks for a new kind of picture.
- Glyph fallbacks stay upright: a glyph is never turned at random.
