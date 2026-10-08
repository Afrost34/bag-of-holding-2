# 0008 — Map pictures download when a map opens

Date: 2026-10-08 · Status: accepted · Amends 0006 (what a sync downloads)

## Context

ADR 0006 copies every file of the data repository to every device. The map library holds
hundreds of battle map pictures (about 270 MB as WebP), most of which a given device never shows:
a phone at the table needs tonight's map, not the whole library.

## Decision

- Map pictures (`maps/assets/…` and `campaigns/<c>/maps/assets/…`) are **lazy**. A sync neither
  downloads one this device does not have nor takes its absence as a deletion: it counts as here
  and unchanged (`SyncOptions.lazy` in `packages/storage/src/sync/engine.ts`).
- When a map shows a picture this device does not have, `fetchMissing` (`apps/web/src/app/sync/
lazy.ts`) reads it from the repository, as it was at the last sync (`fetchLazyFile`), and keeps
  it. From then on it syncs like any other file: changes go both ways.
- A picture made on this device uploads as usual. Offline, a missing picture shows the map's grid
  and items without it, and is asked for again next time.

## Consequences

- A picture deleted on one device is not deleted on devices that never downloaded it; the
  repository keeps it until it is deleted where it is present. No data is ever lost.
- Everything else (notes, characters, maps' own files, homebrew) still syncs whole, so the app
  works offline as before once a map has been opened.
