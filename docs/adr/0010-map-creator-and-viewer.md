# 0010 — Maps: a Creator and a Viewer on one file

Date: 2026-10-10 · Status: accepted

## Context

One editor mixed drawing the map (stamps, brushes, terrain) with using it at the table (pins, notes,
routes, spell templates). The owner wants flat maps with no virtual-tabletop behaviour: the
**Creator** makes the map's visuals (battle, city, world; a region is a world map at another scale);
the **Viewer** opens the map to place pins, link notes and any other entity, trace routes, measure,
hide and reveal parts, and switch between versions of the map.

## Decision

- A map is one file (`maps/<id>.json`, or in a campaign). It lives in the library or in a campaign,
  chosen by the owner; its pins, routes, variants and reveal areas are stored **in the map**, so they
  follow it.
- Two modes of one screen: `#/maps/<id>` is the Viewer, `#/maps/<id>/edit` the Creator. A button in
  each goes to the other. New maps open in the Creator; links and lists open the Viewer.
- The Creator shows the map's art only (pins and routes are drawn but hidden there). Its tools:
  select, pan, stamp, brush, terrain, eraser, wall (drawn only), text, measure.
- The Viewer's tools: pan, select (pins and routes only), pin, route, measure, spell template (a
  range to measure, not play). Measure is in both.
- A pin may lead to any entity of the app (a note, a compendium entry, another map).
- Variants: a map keeps named sets of what is shown (which layers and pins), so one map can be a
  night version or another floor. Old maps are converted in place (their background and extra
  pictures become picture layers, their pictures' visibility becomes variants).
- The player window may show a map full screen, with measure and range templates, keeping secret
  pins and unrevealed areas hidden and letting the DM reveal them live. This amends ADR 0009: the
  window is still the board's only writer, but a board may be one map shown full screen.
- Walls are drawn only (no vision, no collision); the grid is an overlay in the Viewer and a preview
  in the Creator.

## Consequences

- Maps stop being "prep only": the Viewer is the table's map. Undo history is per mode.
- The build is staged: split (this ADR, first), then variants and conversion of old maps, fog and the
  player window, then terrain and scatter tools, city tools, world generator and labels, interiors.
