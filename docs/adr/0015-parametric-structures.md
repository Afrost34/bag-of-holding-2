# 0015 — Whole buildings are structure items, one per floor, planned on grid cells

Date: 2026-10-11 · Status: accepted

## Context

The owner wants to say "a two-floor tavern, eight rooms, rustic" and get a finished building from
the Forgotten Adventures packs: rooms, walls, doors, windows, stairs, floors to step through, and
furniture. Until now a building was only a roof outline, and the dungeon generator placed loose
rooms with no seed kept. The owner chose:

- live, then bake;
- one layer and variant per floor;
- floor plans made of merged rectangles, with crooked walls, 45° corners and corners dragged by hand;
- rooms that can be re-rolled one by one, locked, split and merged.

## Decision

- **A `structure` item per floor**, all tied by `group`. Each floor sits on a layer of its own and
  has a variant that shows the map's other layers and that floor; Page Up and Page Down step
  through them. `spec` (a `BuildingSpec`) is the same on every floor: archetype, style, the
  pictures the style picked (the palette), floors, rooms, windows, crookedness. The footprint
  (`points`), the dragged corners (`bends`) and the cut corners (`chamfers`) are the same on every
  floor too.
- **The plan is on whole grid cells** (`structure/floorplan.ts`, pure):
  - the stairwell comes first, in the same cells on every floor, from its own seed, so Roll
    again keeps it;
  - the free cells are cut across their longer side into rooms of 2 × 2 cells at least;
  - doors form a spanning tree over the rooms that touch, plus about a fifth more for loops,
    and a front door on the ground floor;
  - windows go on the outer walls.

  Rooms are given their types by the archetype's programme, the biggest room first
  (`archetypes.ts`). Locked rooms (`rooms` on the item) are kept and the rest is cut again; any
  change to one room freezes the floor as it is. Besides the classic archetypes, Rust & Sunfire
  has a refinery or foundry, a shanty stack, a winch or lift station, an arena and a chapel,
  with room recipes of their own (foundry floor, refinery, shanty room, winch house, arena pit,
  chapel). Districts can be laid out in platform rings (`city.ts`, `ringCells`): rows of
  buildings round a hub, ring roads and a few spokes, the blocks of a row joined with no alley.

- **Bent walls without losing joins.** The footprint stays on cells. Dragged corners and
  crookedness move every point of the plan by inverse-distance weighting of the corner offsets,
  so walls, doors and stairs stay joined. Cut corners replace a corner by two points, in the
  footprint and in the room that has that corner. The editor shows handles on the corners as
  drawn, and a drag becomes that corner's bend.
- **Drawn as ordinary items.** `structureParts` turns a floor into rooms (floor, outer wall,
  doorways), walls between rooms (drawn over the floors, because touching rooms otherwise share
  a floor), and door, window and stair stamps. The ids are fixed, so the scene redraws only what
  changed. The scene, the lights and the flat render draw these parts. **Bake** puts the same
  parts on the map in its place, so live and baked always match.
- **Styles** (`styles.ts`) name the pictures with `Wanted` queries: floors (ground, upper,
  cellar), wall strip, door, window, stairs, roof. They are picked once, when the building is
  made; Pick again picks afresh. Without packs a building is drawn (drawn floors, ink walls,
  drawn doors). A door picture stands in a `gap` doorway, a new door kind with nothing drawn.
  Eleven styles: the Core ones (stone, timber, brick, shack) and the settlement sets (desert
  adobe, dwarven, drow, arctic, industrial), plus Rust and Heliark ruins for Rust & Sunfire. A
  query's words are "any of"; a preference order is a list of queries. Working rooms on the
  ground floor (kitchen, storage, smithy…) get the style's hard floor.
- **Roofs.** Every floor but the cellar has a roof part (a `building` item over the footprint, so
  it lies on its slopes like any roof; flat for desert and metal styles) and a chimney stamp over
  each hearth room. The map's Roofs switch takes it off. While the roof is on, the floor draws
  only its rooms' outer walls (no doorways, furniture, inner walls, stairs, doors or windows: they
  would show through or over the eaves), and its lamps give no light. Bake bakes with the roof
  off.
- A building moves by whole squares with all its floors, and its locked rooms move with it.

- **Furniture** (`structure/furnish.ts`): each room type's interior recipe is resolved once, when
  the building is made (`spec.furnish`, with `~clutter` and `~ruin`), and for each furniture
  picture its broken one (`spec.broken`). A room's pieces are laid live from its seed by the dress
  engine, as stamps among the building's parts, so they bake, light and render like the rest.
  Dressing (none, lived-in, cluttered) and condition (kept, worn, ruined: pieces broken or knocked
  over, rubble added) are building settings. A floor frozen by a room change keeps its doors, so
  Furnish again changes only that room.

## Consequences

- Pick again and a room's new type pick furniture as well; a type new to the building is added.
- Roofs, more styles, dungeons, ships and docks are new specs and planners on the same item and
  drawing path.
- Tests check that plans tile the footprint, that every room is reachable, that the stairs line
  up, that locks survive Roll again, and that baking keeps every part.

## Dungeons (PR 12)

- A dungeon is a one-floor structure whose archetype has a `layout` (`archetypes.ts`): its plan
  comes from `dungeonplan.ts` instead of the building planner, in the same shape (rooms on cells,
  doors, walls), so types, furniture, locks, Roll again and Bake work as for buildings. Corridors
  are rooms of type `corridor`. Dungeons have no roof, stairs or windows.
- Layouts: rooms joined by corridors two cells wide; packed rooms; the Heliark facility (a spine
  corridor and cross corridors, the blocks cut into rooms); caves (a cellular automaton, split
  into caverns that open into each other and are drawn as one rounded room with a cave rim).
- Room roles have recipes: treasury, machine room, collapsed room, corridor, cavern, cave camp,
  lair. The Room tool's "Generate a dungeon" makes one of the four kinds, filling the view; the
  old one-shot generator is gone.

## Ships (PRs 13–14)

- A ship is a structure whose archetype has the `ship` layout (`shipplan.ts`): its footprint is
  its hull (a flat stern, straight sides, a bow curving to a point), kept as drawn, not snapped to
  cells. The Building tool draws one by a box: the ship fills it, its bow along the longer side
  (`spec.ship.heading`), at sea or in the sky (`spec.ship.medium`).
- Decks: the main deck (the deck and, for bigger ships, a captain's cabin at the stern) and a deck
  below (hold, crew, galley, gun deck; a sky ship's biggest room is its engine room round a shard
  core), the ladder in the same cells on both. Each deck is drawn as one hull room (the Aquatic
  hull wall strip) with the ship's inner walls between its rooms.
- The main deck's fittings come from the style's `parts` (masts, sails on yards, cannons with
  their muzzles out, capstan, anchor at sea, bowsprit, rudder, stern lanterns, crow's nest).
  Sails show with the map's roofs; sky ships' sails are tinted gold. Small boats (rowboat, canoe,
  raft, sailboat) are one picture filling the box.
- Checked on the real pictures: ships point up, cannon muzzles point down, sails lie across.
