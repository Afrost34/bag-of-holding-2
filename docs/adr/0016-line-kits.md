# 0016 — Walkways and line kits are items drawn as strips and posts along a line

Date: 2026-10-11 · Status: accepted

## Context

Rust & Sunfire's platform cities are tied together by chainwalks, cable bridges and scaffolds,
and their works by pipe runs; other maps want colonnades and railings. Forgotten Adventures has
the pieces as seamless strips (`_Path`: grating and plank walkway decks, metal and wooden
railings, chains, pipes) and as stamps (pillars, flanges). The Dress engine (ADR 0014) places
stamps; it does not lay strips side by side.

## Decision

- A **`kit` item** keeps a line (control points, smoothing, an optional loop), which kit it is
  (`kits/catalog.ts`) and the pictures picked when it was made (`palette`: deck, rail, post).
- A kit is a deck strip down the middle, rail strips to both sides at an offset, and posts every
  few squares (to both sides, or on the line), in pack squares; `scale` multiplies them.
- **Drawn as parts** (`kitParts`): ordinary `path` items with the strip as their texture (they
  bend with the line) and `stamp` items, through the same expansion as buildings
  (`expandStructures`), so the scene, lights and the flat render need nothing new. **Bake** turns
  them into those items.
- Without packs a kit is drawn as coloured lines, without posts.
- The **Walkway** tool (N) draws the line by clicks, as the Road tool does; a picked kit can
  change its kind, size and loop, pick its pictures again, or be baked.

## Consequences

- New kits are data: a deck, rails and posts with `Wanted` queries, checked on real FA names.
- Rows are kits with only posts: a pillar row, a brazier row (lit braziers light the map as any
  lit stamp does). A post can be turned from the line (`turn`) and laid end to end (`fill`): the
  **stair run** lays FA 1x3 flights across the line, stretched a little so whole flights fill it.
- Kits assembled to a size (fountains from basin parts, modular tents) are not line kits. They
  wait for the real names of those folders (`__fixtures__/faNames.ts` has none yet); camps use
  whole tent pictures meanwhile.
