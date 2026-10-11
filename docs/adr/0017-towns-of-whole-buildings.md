# 0017 — A district is built into a town of whole buildings

Date: 2026-10-11 · Status: accepted

## Context

A district (the District tool) draws streets as its ground colour between blocks and its buildings
as roof outlines. Whole buildings (ADR 0015) have floors, rooms and furniture, but are made one at
a time, each with its own layers and variants. The owner wants to generate a full town: varied
buildings with their interiors, streets and materials, in one step.

## Decision

- **Build the town** (a picked district's settings) turns the district's lots into `structure`
  items. It acts on the whole town: the picked district and any district inside it or round it
  (a walled town's market quarter).
- **Planning is pure** (`app/maps/town/townplan.ts`). Each lot gets the biggest rectangle of whole
  grid squares inside it; a lot under three squares across stays a roof outline of the district.
  Near the middle, two neighbouring lots of a block are joined into a **hall** (at least 7 × 8
  squares, clear of every other lot) for a tavern, the temple or the guildhall: single lots are too
  small for a common room. **Zoning** by distance from the middle (or the square): shops, inns,
  guildhall and temple in the core (one temple, one guildhall), houses with a smithy or warehouse
  round them, farmhouses and warehouses at the edge; the district style adds its own (manors in a
  noble quarter). Buildings are taller and better kept in the middle, lower and more worn at the
  edge. Every building's front door faces its street (`BuildingSpec.facing`), and its stairwell is
  in a corner (`stairsAtWall`), so halls keep their floor whole.
- **Looks** (`town/looks.ts`) mix the building styles by weight (a market town is mostly timber,
  with stone in its middle) and choose the paving of the streets and the square, checked on real
  Forgotten Adventures names.
- **One set of layers per town**: Streets, Cellars, Ground floor, First floor… with a variant per
  level, not a layer per building. Floors of each building share a `group`, as before.
- **Streets are items**: a shape (the district less its blocks, as holes) paved with the look's
  texture, the square paved apart, and dressings tied to them (the new "Street life" recipe, a
  market on the square). The lots built leave the district (`removed`), which keeps its wall.
- **Map files share repeated values** (`app/maps/shared.ts`): a structure's spec, and its
  `palette`, `furnish` and `broken` within it, are written once in a `shared` table and expanded
  when read. A town of forty buildings drops from about 2 MB to a quarter of that or less. The
  rest of the app never sees the table.
- A room furnished in the middle (`centre`) that is not a plain rectangle (an L round a stairwell)
  now searches its floor for places when the grid finds none, a square from the walls.

## Consequences

- Building a town needs a battle-map grid: on a map whose squares are larger than a house, nothing
  is built and the panel says so.
- Each town building is an ordinary structure: roll again, set floors, lock rooms or bake as usual.
- Changing the zoning or the looks is data in `townplan.ts` and `looks.ts`.
