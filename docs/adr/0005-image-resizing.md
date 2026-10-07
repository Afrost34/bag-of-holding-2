# 0005 — Resized images through wsrv.nl

Date: 2026-10-07 · Status: accepted

## Context

5etools art comes from its image mirror on GitHub (`raw.githubusercontent.com/5etools-mirror-3/
5etools-img`) at full size: often 1,500–2,000 px wide and 300–500 KB each. Class and species
cards, covers and page headers show them at 150–350 px. Scrolling the Species page downloaded
7.4 MB of images and the browser had to decode all of them, which made pages feel slow. The project
must stay free and has no server of its own.

## Decision

- Pages request a **resized WebP copy** from [wsrv.nl](https://wsrv.nl), a free, long-running
  image resizing CDN that needs no account: `https://wsrv.nl/?url=<original>&w=<width>&output=webp&q=78&we`
  (`we`: never enlarged). URLs are built in one place, `apps/web/src/app/images.ts`.
- Images offer several widths (`srcset` + `sizes`) so high-density screens stay sharp, load lazily
  and decode asynchronously (`ArtImage`; the renderer's `imageUrl(path, width)` service for images
  in text). Images in text link to the full-size original (maps).
- **Fallback:** if a resized copy fails to load, the image switches to the original URL. If wsrv.nl
  ever disappears, pages keep working at the old speed until `images.ts` points elsewhere.
- Both originals and resized copies are cached by the service worker (CacheFirst) for offline use.
- Off-screen art cards use `content-visibility: auto`, so long grids only lay out what is near the
  viewport.

## Consequences

- About 25× fewer image bytes on card pages (Species scroll: 7.4 MB → 0.3 MB).
- A third party sees which public 5etools images are viewed; no user data is sent.
- The desktop app (Tauri) uses the same URLs; a local resizer can replace them later if needed.
