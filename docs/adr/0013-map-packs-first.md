# 0013 — Map tools work from the asset packs first; drawn art is a switch

Date: 2026-10-11 · Status: accepted

## Context

The Creator still offered art drawn in code (flat terrain textures, glyph trees, ink walls and
roofs) next to the owner's Forgotten Adventures (FA) packs, and the packs were reachable only by
folder. The owner wants the tools to work from the packs and nothing else.

## Decision

- **Every picture is sorted once** into a category (`app/maps/packCategories.ts`: ground, water,
  floors, roofs, overlays, wall strips, doors, windows, paths, cliffs, trees, bushes, plants, rocks,
  furniture, decor, clutter, lights…). It is a pure function of the path inside the pack, checked
  against the real FA names in `packCategories.test.ts`. `PackEntry.cat` is set when the index is
  loaded. The corrections found in the real listings are in the rules: a wall strip is a name ending
  `_Path`; only `.jpg` tiles in a `Textures` folder are seamless (the rest are overlays); tracks are
  stamps; door add-ons, cellar doors and trapdoors are objects, not portals.
- **Tools open on their category** (`AssetGrid`): terrain slots start as pack grass, dirt, rock, sand
  and water (`packDefaults.ts`); scatter presets are built from pack folders (forest, rocks, flowers…);
  rooms start with a cobblestone floor and a stone wall strip; walls and room walls take a strip;
  doors and windows snap onto the nearest wall; paths take a strip or a ground texture; building
  roofs take a roof texture; a stamp can be tinted (a multiply).
- **Sizes follow FA**: pictures keep the `_WxH` squares of their name; a texture tile covers
  `width / 200` squares (FA art is 200 px to a square); a wall strip is one square tall.
- **Drawn art is a switch** (`artPrefs.ts`, per device, off by default). It shows anyway while no pack
  is imported, so a new map is never empty. The "Pack contents" page (`#/maps/packs`) shows how each
  pack was sorted, with samples, and holds the switch.
- **Layout follows Dungeondraft**: labelled tool groups (`ToolRail`), a resizable options/library
  panel, the app sidebar shrinks to icons while a map is open.

## Consequences

- The same picture in two packs (or as `.png` and `.webp`) is kept once (by path without extension).
- `.dd2vtt` export stays dropped (ADR 0012).
- Wall corners and endings of the wall's set are laid at right-angle turns and open ends (`wallPieces.ts`);
  a pack can be switched off (`PackMeta.disabled`: unlisted, still drawn on maps that use it); the
  category is stored in the pack index (`SORTER_VERSION` makes older indexes sort again); stamps show a
  ghost and turn with the wheel; prefabs are saved per device (`prefabs.ts`).
- Not done: a water brush with shallow and deep colours (the terrain brush with a water texture and a
  soft edge stands in), a material brush of its own (the terrain brush's Border toggle), a cave brush
  with pack art beyond the cave cliff rim, modular wall pieces other than corners and endings.
- Checked on the real Core pack (148,689 pictures): the index reads in 82 ms, sorting takes 270 ms and
  a picture is cut out of the 2.5 GB zip; storing 2.5 GB in a webview's storage is not checked.
