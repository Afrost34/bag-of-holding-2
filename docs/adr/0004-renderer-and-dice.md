# 0004 — Renderer and dice

Date: 2026-10-07 · Status: accepted

## Decision

- **Renderer (`packages/renderer`)** turns 5etools entries and `{@tags}` into React. It is app
  agnostic: links, rolls, embedded entities, references and image URLs are services the app
  provides (`RendererProvider`). The same components render pages, hover previews, cards and print.
- **Tags are interpreted once** (`describeTag`) into a typed model mirroring 5etools argument
  layouts and default sources. Entity links carry candidate keys built with the index's own
  identity rules; the index resolves them (`resolveCandidates`, with `*` for parts a tag omits,
  e.g. a subrace's parent source).
- **Conformance on real data:** every tag in the pinned release is understood; ≥ 99.5 % of entity
  links resolve (the rest are generated magic item variants, built in M3, and upstream typos);
  every entity renders without errors and no entry type is unknown.
- **Dice (`packages/dice`)**: our own parser and evaluator for everything 5etools writes (dice,
  arithmetic, ×, thousands separators, parentheses, ceil/floor, variables like `PB`, prompts,
  keep/drop, `;` alternatives). Randomness is `crypto.getRandomValues` with rejection sampling.
  Advantage/disadvantage turns the single d20 into 2d20 keep highest/lowest. Every dice expression
  in the data parses and rolls in CI.
- **3D dice are display only:** the result is rolled first, then `@3d-dice/dice-box-threejs` throws
  dice that land on those values. Loaded lazily; can be turned off per device.
- **One database owner:** the data worker holds an exclusive Web Lock on the SQLite OPFS pool.
  A second tab/window shows "open elsewhere" and takes over when the owner closes.
