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
- Universal VTT (`.dd2vtt`) export is back (it supersedes ADR 0012 on this point, as the guide's export page asks
  for it): the Export dialog writes the picture, sight lines (walls, room outlines, buildings), portals (room
  doors, pack doors and windows), lights and the ambient colour (`uvtt.ts`).
- Wall corners and endings of the wall's set are laid at right-angle turns and open ends (`wallPieces.ts`);
  a pack can be switched off (`PackMeta.disabled`: unlisted, still drawn on maps that use it); the
  category is stored in the pack index (`SORTER_VERSION` makes older indexes sort again); stamps show a
  ghost and turn with the wheel; prefabs are saved per device (`prefabs.ts`).
- The water brush has shallow and deep colours with a blend (`WaterLook` on a stroke: a tint over the
  texture and a blurred deep core); the material brush is the terrain brush with a rock texture and a
  border; the cave brush is a rounded room outline with a cave cliff rim and an earthen floor.
- Packs are copied into storage by a worker writing in place (`packCopy.worker.ts`): the main thread's
  writable stream keeps a swap copy until it closes, which made a 2.5 GB pack need 5 GB.
- Wall pieces: stone, metal (`Wall_Metal_*_Path`), garden metal and wood sets get their corners, endings,
  diagonals, rounded corners and T/cross junctions (`wallPieces.ts`); other sets keep the plain strip.
- Checked on the real Core pack (148,689 pictures): the index reads in 82 ms, sorting takes 270 ms and
  a picture is cut out of the 2.5 GB zip; storing 2.5 GB in a webview's storage is not checked.
