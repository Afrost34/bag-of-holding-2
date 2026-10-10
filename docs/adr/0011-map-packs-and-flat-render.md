# 0011 — Map art packs stay on the device; the Creator keeps a flat picture

Date: 2026-10-10 · Status: accepted

## Context

The map Creator is rich (thousands of stamps, generated towns and forests) and its art comes from
asset packs of several gigabytes (Forgotten Adventures style zips, one pack alone with 150,000
pictures). The owner uses the Creator on a PC and wants phones and tablets to view maps without any of
that art installed, and wants imported packs to survive deleting the original zip.

## Decision

- **Packs are imported by copying the zip** into the device's own storage (`map-assets/packs/`, OPFS)
  and are read in place: the zip's central directory (zip64 included) is indexed once, and a picture is
  cut out of the stored zip when it is shown or placed. Previews are made on first sight and cached.
  Nothing is unpacked, so a 2.7 GB pack imports in seconds. The library is **local to the device and
  never synced**; the same zip imported twice is recognised.
- A stamp is referred to as `pack:<id>:<path>` (or `glyph:<name>` for art drawn in code); a map keeps
  the reference, never the picture. Without the pack the stamp is missing on that device.
- **The Creator keeps a flat picture** of the map's art (`render`, one WebP per variant, at most 4096 px
  wide) a few seconds after the art last changed, stored with the map's assets (lazily synced, ADR 0008)
  and valid only while the art's fingerprint matches (`artHash`). The Viewer and board cards show it
  instead of drawing the art, so devices without the packs see the map as drawn. Pins, routes and fog
  stay live on top of it.
- Procedural items (scatter, districts, furniture) are stored as a seed and a few numbers and made
  again when the things they react to (roads, rivers, water, buildings) change; baking turns them into
  ordinary items.

## Consequences

- Editing a map that uses packs needs those packs on the device (the library of a second PC has to be
  imported there). Viewing needs nothing.
- The browser's storage quota limits the library on the web build (the import says how much room there
  is); the desktop webview allows much more.
- The flat picture is a cache: it can always be rebuilt by opening the map in the Creator.
