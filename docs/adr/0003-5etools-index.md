# 0003 — The 5etools index

Date: 2026-10-07 · Status: accepted

## Decision

- **Source of data:** tagged releases of `5etools-mirror-3/5etools-src`. The file list and git blob
  SHAs come from one GitHub API call (`git/trees/<tag>`); contents come from
  `raw.githubusercontent.com` (CORS-enabled; release zips are not downloadable from a browser).
  Local folders/zips are an alternative; their SHAs are computed locally with the same git blob
  algorithm, so both sources are interchangeable for incremental updates.
- **Storage:** SQLite (official WebAssembly build) in a dedicated worker, persisted in OPFS with
  the `opfs-sahpool` VFS, which needs no COOP/COEP headers (GitHub Pages cannot send them).
  Browsers without OPFS fall back to an in-memory index. The index is a cache: rebuildable from
  5etools files and homebrew packs. A schema version bump drops and rebuilds it.
- **Extraction is generic:** every top-level array of identifiable objects becomes entities of
  that type, so new 5etools types need no code. Everything else is kept as aux data. Files under
  `data/generated/` are lookup data, not entities (they duplicate other files), except
  `gendata-tables.json`. Foundry/tooling files are not downloaded.
- **Keys** (`packages/data5e/src/keys.ts`): `type:identity@source`, lowercase; composite types use
  the same parts as 5etools `{@tag}` links. Stored in user data; stable by contract.
- **Editions:** like 5etools, a source is 2014 when published before the 2024 PHB (2024-09-17);
  an entity's own `edition` field wins. Source names and dates come from books/adventures metadata
  and from `js/parser.js`, parsed statically (never executed).
- **`_copy`:** resolved after every install with a TypeScript port of 5etools'
  `DataUtil.generic.copyApplier` (all mod modes, monster templates, `<$variable$>` placeholders).
  Raw and resolved JSON are both stored so copies re-resolve when a parent changes.
- **Installs are per-file transactions,** so an interrupted download resumes; books/adventures and
  `parser.js` are applied first because other files' editions depend on them.
- **Conformance:** the pinned version (`src/testing/localData.ts`) is downloaded in CI and every
  file is extracted, keyed, copy-resolved and fully installed. Unknown structure fails the build.

## Not yet

- `_versions` (generated creature variants) — needed when rendering creatures (M3).
- Images: fetched on demand from the 5etools image mirror and cached (M3).
