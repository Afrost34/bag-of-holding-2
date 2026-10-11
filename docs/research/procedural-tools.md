# Procedural set-dressing tools for the map Creator

Ideas for making maps faster with Forgotten Adventures (FA) packs, in the spirit of game-engine
procedural tools (Houdini / Unreal PCG). Written 2026-10-11 from a survey of the map code and of the
packs in `Downloads\Forgotten Adventures Pack` (Core 1.04 + Expansion 1.14).

## Status (2026-10-11)

Built: every tool in the list below except the two kits under 15.

| #          | Where it is                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 1–4        | Dress tool and recipes (`app/maps/dress/`, ADR 0014): engine, interiors, along walls, table dressing   |
| 5          | Randomize and Swap material (`randomize.ts`, `VariationsPanel`)                                        |
| 6, 9       | Biome brushes, edges (`dress/nature.ts`, `recipes.ts`)                                                 |
| 7, 8       | Buildings, dungeons, ships, docks (`app/maps/structure/`, ADR 0015)                                    |
| 10         | Age / decay and ruins (`dress/decay.ts`)                                                               |
| 11         | Lit stamps light the map (`glow.ts`), "Light this room"                                                |
| 12         | Storage pile and Adventuring gear recipes (`place: 'cluster'`)                                         |
| 13, 16, 17 | Settlement generators: market, camp, graveyard, farm, scrapyard (`dress/settlements.ts`)               |
| 14         | Walkway kits with only posts: colonnade, pillar row, brazier row (`kits/catalog.ts`, ADR 0016)         |
| 15         | Stair run (a Walkway kit). **Not built:** fountains from `Basin_Parts` and modular tents (see below)   |
| 18         | Track recipes (boot prints, animal tracks)                                                             |
| 19         | Cliffs along an elevation height (`ElevationPanel`, `cliffRange`)                                      |
| 20         | Dungeon room roles (`structure/dungeonplan.ts`)                                                        |
| Prefabs    | Synced files `map-prefabs/<id>.json` (`prefabs.ts`, `prefabStore.ts`); "Vary when placed" swaps shapes |

Second pass (deeper rules): `ring` and `front` placements, `count` keeping the middle pieces, and
height/slope bands from the elevation (ADR 0014). The camp, market and graveyard use them; new
recipes: Stone circle, Highlands by height; forest and mountain biomes thin out on steep ground.
Roads can follow the land (`landRoute.ts`): A* over the elevation with a slope cost, round hills
and through passes, never over cliffs or through the sea.

Waiting on the packs: fountains and modular tents need the real file names of `Basin_Parts` and
`Tents/Modular` in `app/maps/__fixtures__/faNames.ts` (never invented). Copy a listing of those two
folders from the desktop pack to build them.

## What exists today

- **Scatter** (`app/maps/scatter.ts`, `scatterDoc.ts`): area or along a line, seeded, Poisson spacing,
  clustering, avoids roads/water/buildings, tied to a shape or path (`within` / `follow`), `onlyOn`
  terrain, bake. Pack presets in `packDefaults.ts` (forest, rocks, flowers, rubble, clutter, fence…).
- **Districts and buildings** (`city.ts`): grid, radial, organic and linear streets. A building is only
  a roof outline (`cityView.ts` `drawRoof`), with no interior.
- **Rooms, doors, dungeon and cave generators** (`rooms.ts`). `generateDungeon` places random rooms
  joined by corridors; it does not split a footprint and keeps no seed or settings on the map.
- Elevation and contours, island generator, wall strips + pieces, doors snapping to walls, lights,
  mirror, prefabs (saved per device in localStorage).

Gaps:

1. **"Furnish it as…"** (`FURNISH_PRESETS`, `scatterDoc.ts`) is a random scatter of drawn glyphs that
   ignores walls, doors and picture sizes. It is the last drawn-art default (against ADR 0013).
2. Scatter has no wall, corner, on-top-of or around-X placement.
3. No variant re-roll, material consistency, or light added with a lightsource stamp.
4. Elevation drives no art. Rooms are missing from `obstacleSignature`.
5. No floors (another floor is a variant, ADR 0010) and nothing about ships.

## What the packs give rules to work with (from file names alone)

- **Footprint in squares** in the name (`_A3_2x1.webp`): about 112k of 149k Core files. FA art is
  200 px per square.
- **Variant sets** (`_A1`…`_A30`, sets B, C): swappable versions of one object.
- **Material and colour words** (`Wood_Walnut`, `Metal_Rusty`, `Light` / `Dark`).
- **Folders that say where things go**: `Interior_Wall_Lights`, `Wall_Hangings` (walls);
  `Table_Arrangements` (on tables); `Tree_Shadows` (under trees); `Weed_Edges`, `Ivy_Vines`;
  `Rubble_Pieces` vs `Rubble_Piles`; `Shack_Floor_Damage_Overlay`; `Cobwebs`; `Tracks`.
- **Modular kits**: `Basin_Parts` (fountains), `Tents/Modular`, tarps (bases, cloths, add-ons),
  awnings, stairs, ~3,900 pillars, `Cliff_Paths`; 41 Core wall sets with 21-piece kits; the Aquatic
  ship kit (see below).

Open question for every facing rule: which way FA furniture faces by default (do chairs face down?).
Check on real art per category before writing rules.

## The tool list

### Tier 1: the biggest time savers

| #   | Tool                     | What it does                                                                                                                                                                                                                                  | Pack folders                                     |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | **Recipe engine**        | A recipe is a list of rules: which pictures (a `Wanted` query), where (wall, corner, centre, around X, on top of X, edge, along), how many, facing, layer. Seeded, re-made on change, saveable. Built as `furnish.ts` in the structures plan. | all                                              |
| 2   | **Smart Furnish**        | Replaces the glyph presets: beds, wardrobes, shelves against walls facing in; table in the middle with chairs facing it and a rug under; barrels and crates in corners; doorways and walkways kept clear.                                     | Furniture/\*, Decor/Storage, Rugs_and_Carpets    |
| 3   | **Along the walls**      | New scatter mode: things along the inside of a room's walls, facing in, skipping doors (a sconce every N squares, banners, shelves, crates).                                                                                                  | Interior_Wall_Lights, Wall_Hangings, Storage     |
| 4   | **Table dressing**       | Fill picked tables: a ready arrangement, or plates and cups at each chair plus food, paper or tools in the middle.                                                                                                                            | Table_Arrangements, Food, Kitchenware, Paper     |
| 5   | **Variation randomizer** | Swap each selected stamp for a sibling variant of the same size, with a small turn/flip/size/tint change. "Material swap" across a selection (walnut to red wood).                                                                            | name stems, variant codes                        |
| 6   | **Layered biome brush**  | One stroke: canopy trees, their shadows on a layer below, undergrowth at the edge, stumps/logs/leaves in clearings, thinning towards the edge. One recipe per biome.                                                                          | each biome's Flora, Decor, Tree_Shadows          |
| 7   | **Parametric buildings** | "A 2-floor tavern, 8 rooms, rustic dressing" gives a finished building: footprint split into rooms, walls, doors, windows, stairs lining up between floors, furniture by room type, roof. One layer + variant per floor. See the plan below.  | wall kits, doors, windows, stairs, floors, roofs |
| 8   | **Parametric ships**     | Rowboat to galleon: hull from the Aquatic kit, masts, sails, rigging, cannons, and lower decks (gun deck, crew, captain's cabin, hold). See the plan below.                                                                                   | Aquatic/…/Vehicles/Ships, Boats, Siege_Weapons   |

### Tier 2: themed generators and finishing passes

| #   | Tool                            | What it does                                                                                                                                                        |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | **Edge dressing**               | Along shape edges, roads and walls: weed edges, long grass, leaf piles, stones. Along water: reeds, lily pads, shore rocks.                                         |
| 10  | **Ruin / decay brush**          | Paint with a strength slider: rubble by walls and in corners, floor damage overlays, cobwebs, ivy, broken barrels, chairs knocked over.                             |
| 11  | **Automatic lights**            | Any lightsource stamp gets a matching light (colour and radius by folder). "Light this room" puts sconces along the walls.                                          |
| 12  | **Clutter clusters**            | Click to drop a natural pile: stacked crates with small offsets, barrels together, sacks around (storage pile, camp, smithy corner).                                |
| 13  | **Market / camp generator**     | Stalls from awning and tarp kit parts, modular tents, carts, crates, a campfire with seats.                                                                         |
| 14  | **Rows of objects**             | Pillars every N squares, mirrored rows, statues and braziers down a hall, exact spacing and matching ends.                                                          |
| 15  | **Modular kits**                | A fountain of any size from basin parts, a tent from its pieces, a staircase as long as the drag.                                                                   |
| 16  | **Graveyard generator**         | A loose grid of graves and tombstones (some broken), a crypt, paths, dead trees.                                                                                    |
| 17  | **Farm / field generator**      | Crop rows on tilled soil, fences, hay, farm tools, old crops.                                                                                                       |
| 18  | **Track brush**                 | Footprints, animal tracks or cart ruts along a path, turned to follow it.                                                                                           |
| 19  | **Cliff dressing by elevation** | Cliff edges along contour lines, boulders and scree at the foot.                                                                                                    |
| 20  | **Dungeon dresser**             | After the dungeon generator: each room gets a role (guard room, storeroom, shrine, prison, crypt, treasury) and its recipe; corridors get torches, cobwebs, rubble. |

### Infrastructure

- **Prefabs with random slots** ("any table from this set") and synced through the data repo instead of
  localStorage.

### Recommended order

0. Finish and merge the WIP UX batch on `maps/ux-1` (`outline.ts`, preset shape drag). The building
   tool drag relies on `presetOutline` / `finishFrom`.
1. Parametric buildings, PRs 1–2 below. They build the recipe engine (1), Smart Furnish (2), wall
   placement (3) and table dressing (4) along the way, and switch plain rooms off glyph presets.
2. Variation randomizer (5).
3. Building roofs and styles (PR 3), then ships (PRs 4–5).
4. Layered biome brush (6) and edge dressing (9).
5. Automatic lights (11) and ruin / decay (10). `condition` on buildings shares the decay rules.
6. Themed generators (13–17), then the dungeon dresser (20), which reuses the recipes.

---

## Plan: parametric buildings and ships (tools 7 and 8)

### Context

The owner wants to say "a 2-floor tavern, 8 rooms, rustic dressing" or "a brigantine with a gun deck"
and get a finished map built from the FA packs.

What the packs have (Core 1.04 + Expansion 1.14; 200 px per square; `_WxH` = squares):

- **Buildings: a complete modular kit.** 41 Core wall sets with a 21-piece kit each (straights, corners,
  joints, endings, `_Path` strips) in 5 colours, plus Desert, Drow, Dwarf, Industrial and Arctic sets.
  Doors, frames and windows; stairs (1x3, corner pieces), ladders and trapdoors. 5x5-square floor
  textures. Furniture for every room type: bars, ovens, beds, bookshelves, display cases, forges,
  altars, thrones, cells, storage, plus `!Arranged_*` groups.
- **Roofs:** only tileable roof textures (4x4 squares) and chimneys. No pitched roof pieces, apart from
  Desert domes and greenhouse roofs.
- **Ships:** no whole ships beyond rowboats, rafts, a small sailboat, canoes and kayaks. There is a full
  kit in `Aquatic/.../Vehicles/Ships/`: `Ship_Hull_Wall` / `Ship_Wall` / `Ship_Railing` pieces
  (straight, corner, DIAG, ending); mast bases, masts, yards and matching `Sail_Yard_*` (5–14 squares);
  rigging, bowsprits, figureheads, rudders and wheels, capstans, anchors, crow's nests and flags; one
  fixed hull image, 4x11 squares. Cannons and cannon hatches (gun ports) are in Core
  `Combat/Siege_Weapons`.
- **Below decks:** no dedicated art. Lower decks are assembled from ship walls, plank floors, hammocks,
  cargo, ladders and trapdoors.

### Decisions made with the owner

- **Live, then bake.** A structure is one item: its settings and seed are saved, and it is regenerated
  on change, with Roll again. Bake turns it into ordinary rooms, walls and stamps (like districts and
  scatter).
- **One layer + variant per floor.** Step between floors with Page Up/Down; the floor below shows
  faintly (`layerGhost`). Stairs line up between floors.
- **Ships:** small boats, sailing ships (sloop / brigantine / galleon, with cannons) and lower decks.
  No docks for now.
- **Roofs:** a roof polygon filled with an FA roof texture, with a shaded ridge and pack chimneys. The
  existing `hideRoofs` switch shows the interior.

### Design

#### Data: a new item kind `structure` (`app/maps/model.ts`)

```ts
interface StructureItem {
  kind: 'structure';
  id;
  x;
  y;
  rotation; // origin = top-left of the grid box; rotation in 90° steps
  group: string; // the same id on every floor's item
  floor: number; // 0 = ground, -1 = cellar / hold, 1 = upper floor / gun deck…
  spec: StructureSpec; // the same on every floor (edits go to all siblings)
}
type StructureSpec = BuildingSpec | ShipSpec;
interface BuildingSpec {
  type: 'building';
  seed;
  w;
  h; // footprint in squares (rect, L or T shape)
  shape: 'rect' | 'L' | 'T';
  archetype:
    | 'house'
    | 'tavern'
    | 'shop'
    | 'smithy'
    | 'temple'
    | 'manor'
    | 'tower'
    | 'warehouse'
    | 'barracks';
  floors: number;
  cellar: boolean;
  rooms: number; // rooms per floor (target)
  style: string; // id in STYLES (Core stone, Timber, Desert, Dwarf, Drow, Arctic…)
  dressing: 'bare' | 'lived-in' | 'cluttered';
  condition: 'kept' | 'worn' | 'ruined'; // broken walls / fallen doors / floor breaks
  roof: 'tiles' | 'thatch' | 'slate' | 'flat';
  windows: boolean;
}
interface ShipSpec {
  type: 'ship';
  seed;
  class: 'rowboat' | 'raft' | 'sailboat' | 'canoe' | 'kayak' | 'sloop' | 'brigantine' | 'galleon';
  length: number; // squares; the class sets the default and range
  decks: number;
  guns: number;
  sails: 'set' | 'furled' | 'none';
  wood: string;
  sailColour: string;
  flag?: string;
  dressing: 'bare' | 'crewed' | 'cargo';
}
```

- Add `'structure'` to `KINDS` and `parseMap`.
- Add structures to `obstacleSignature` (`scatterDoc.ts`), and add rooms too (missing today).
- Everything is planned on grid squares (`doc.grid.size`) so FA 1x1/2x1/3x1 pieces line up.

#### Pure planners (each tested, no Pixi)

**`app/maps/floorplan.ts`: `planBuilding(spec): BuildingPlan`.** Per floor: rooms as cell rectangles
with a type, walls as segments (outer / inner), doors, windows and stairs.

- Footprint: rect, L or T in cells. Upper floors use the same footprint; the cellar may be smaller.
- Stairwell first: a 1x3 or 2x3 cell block reserved in the same place on every floor, next to an
  inner wall.
- Splitting: recursive grid-aligned cuts (the idea of `subdivide` in `city.ts`, on integer
  rectangles), across the longest side, minimum room 2x2 cells, until there are `rooms` pieces. Floors
  of 8+ rooms, or manor/barracks, get a 1–2 cell hall strip first.
- Room programme per archetype, assigned by size and position (table in `archetypes.ts`). Tavern:
  ground = common room (largest, street door), kitchen (next to it, hearth), storage, stair; upper =
  bedrooms and hall; cellar = storage.
- Doors: a spanning tree over room adjacency plus ~20% extra loops; each on a shared wall segment at
  least 1 cell from a corner. Front and back doors on outer walls.
- Windows: on outer walls by spacing rules; none in the cellar.

**`app/maps/furnish.ts`: `furnishRoom(room, recipe, rng, occupancy): Placement[]`.**

- Recipes per room type: against-wall, corner, centre, along-wall, by-hearth, table-set (table plus
  chairs, or an `Arranged_Tables_with_Chairs` piece), rug, light, clutter-on (on tables or shelves).
- Each rule names an FA query in the `Wanted` format (`packDefaults.ts`), e.g.
  `{cats:['furniture'], words:['bar']}`.
- Occupancy grid keeps door swing cells, stair cells and walkways free, so a path from every door to
  the room centre stays open (tested).
- Dressing scales how many optional rules run and clutter density; condition swaps in Broken or Fallen
  variants.
- Without packs: a glyph fallback through `glyph:` refs keeps the map usable (ADR 0013).
- Tests: recipe queries resolve against a fixture of real FA paths (as in `packCategories.test.ts`).

**`app/maps/styles.ts`: `STYLES`.** Each style names a wall set (strip + pieces through
`wallPieces.ts`), floors (ground, upper, cellar), a door material, windows, a roof texture and a wood
colour. One per FA biome settlement: Core Stone, Core Timber (PlasterWood), Brick, Desert, Dwarf, Drow,
Arctic, Industrial. Pictures resolved with `pickOne`.

**`app/maps/roofs.ts`.** The roof follows the top floor's footprint split into rectangles; each gets a
ridge along its long axis (hip or gable) drawn with `drawRoof` / `shadedHalf` (`cityDoc.ts`). Fill is
the style's `Roof_Texture_*`. Chimneys (`Structures/Building/Roofs/Chimneys`) go above hearth cells.
Desert uses `Domes/`.

**`app/maps/shipplan.ts`: `planShip(spec): ShipPlan`.**

- Small boats: one whole-boat stamp from `Vehicles/Boats` or Canoes/Kayaks, sized by `_WxH`;
  `dressing: 'cargo'` uses the Filled variant; oars optional.
- Hull: a class table (length, beam, masts, decks, gun range). Outline traced on the grid: pointed bow
  from DIAG pieces, straight waist, square transom. `Ship_Railing` on the main deck;
  `Ship_Hull_Wall` / `Ship_Wall` below.
- Main deck: masts on `Mast_Base_2x2` at set fractions of the length; bowsprit and figurehead at the
  bow; wheel (tiller on a sloop), rudder and stern lantern at the stern; capstan, hatches and a ladder
  down; cannons in pairs on both sides.
- Sails overlay: `Sail_Yard_*` sized to the beam, rigging, flags, crow's nest, drawn above the main
  deck; `'furled' | 'none'` hides it.
- Lower decks: each a floor (variant) with the hull outline shrunk by one cell per deck. Gun deck:
  cannons at hatch ports. Crew deck: hammocks forward, a galley. Stern: captain's cabin (desk, bed,
  chest) with a door. Hold: barrels, crates, sacks. Ladders line up with main deck hatches. Rooms reuse
  `floorplan.ts` splitting inside the hull, with ship programmes in `archetypes.ts`.

#### Rendering and editing

- **`app/maps/structureView.ts`**, called from `drawItem` in `scene.ts`. Builds one floor's plan, then
  draws room floors with `terrainPattern` (as `roomFloorView`); walls through the strip and piece code
  (`stripWallView`, `junctionPieces`), under the floors as rooms do; pack door, window and stair stamps;
  furniture sprites (as `scatterView`); the roof unless `hideRoofs` is on or another floor is shown.
  Composite, so `cullable = false`. Redraw key: spec + floor + grid size. Plan memoised per
  (group, spec).
- **Building tool** (Design group): a Generate section with archetype cards, floors 1–4, cellar, rooms
  per floor, style, dressing, condition, roof. Dragging a rect (`presetOutline`) snaps to whole cells.
  Plain "draw a roof" stays.
- **Ship tool** (Design group): click to place, drag to set length along the drag direction. Panel:
  class cards, length, decks, guns, sails, wood, sail colour, dressing.
- **`structureDoc.ts` `addStructure(doc, layerId, spec)`**: per floor, a layer named
  "<Name> – Ground floor / Floor 2 / Cellar" (or "Main deck / Gun deck / Hold"), the floor's item, and
  a variant showing the base layers plus that floor; selects the ground floor or main deck.
- **`StructureItemSettings`** (in `ItemSettings.tsx`) edits the spec on every sibling through
  `updateGroup`; offers Roll again, Floors +/− (adds or removes layers and variants), Bake, and Show
  sails for ships.
- **`bakeStructure(doc, id)`** for every sibling: rooms → room items with `doors[]`; walls → wall items
  with a pack texture; furniture, doors, windows, stairs, ship parts → stamps; roofs → a building item.
  Follows `bakeScatter`; ids are `${id}-n`.
- Flat render (`render.ts`) needs no change.

#### Docs

- ADR 0014 "Parametric structures": one item per floor tied by group, plan on grid cells, recipes as
  `Wanted` queries, roofs drawn rather than pack pieces, ships assembled from the Aquatic kit.
- CLAUDE.md: a "Where to look first" row ("A building or ship generator" → `floorplan.ts`,
  `furnish.ts`, `archetypes.ts`, `shipplan.ts`, `structureView.ts`) and a line in the Maps section.

### Delivery: small PRs, each green on `pnpm check` + `pnpm e2e`

1. **Structure item and floor plans.** Item kind, `floorplan.ts`, `styles.ts`, `structureView.ts`
   with floors, walls, doors, windows, stairs. `addStructure`, layers and variants per floor, settings
   panel, Roll again, Bake. The `obstacleSignature` fix.
2. **Furnishing.** `archetypes.ts` and `furnish.ts` for every building archetype, plus dressing and
   condition. Plain rooms' glyph `FURNISH_PRESETS` switch to the same recipes.
3. **Roofs.** Roofs, chimneys, Desert domes, and the remaining styles (Desert, Dwarf, Drow, Arctic,
   Industrial).
4. **Ships, part 1.** Small boats; sailing-ship hulls and main deck; sails overlay; cannons.
5. **Ships, part 2.** Lower decks: gun deck, crew, captain's cabin, hold, ladders lining up.
6. **Wrap-up.** ADR 0014, CLAUDE.md, memory notes.

### Verification

Unit tests (pure):

- Same seed and spec → same plan.
- Rooms tile the footprint with no overlap; every room at least 2x2 cells.
- Every room reachable from the front door; every door on a shared wall, away from corners; stairs in
  the same cells on every floor; ship ladders line up with hatches.
- Furniture stays inside its room, never covers a door or stair cell; a walkway exists from every door.
- Recipe and style queries resolve on the fixture of real FA paths for every archetype and ship class.
- Ships: hull outline closed and symmetric; masts and guns within class limits; sail widths match yard
  sizes.
- Bake keeps every picture and position.

e2e (`apps/web/e2e/maps-structures.spec.ts`):

- Make a map, choose Building > Tavern with 2 floors and a cellar, drag a rect. Three floor variants
  exist; Page Up/Down switches between them. Roll again, then Bake: rooms and stamps appear.
- Place a brigantine; check main deck, gun deck and hold.
- Use the existing mini pack zip, extended with the FA files the recipes need (furniture, doors, a wall
  set, ship parts), cut from real files (Playwright cannot hold the full Core).

Manual proof: `preview_start` the dev server, import the mini zip, generate a tavern and a galleon,
screenshots in light and dark at desktop and 375 px. Keep `a11y.spec` green.
