# 0002 — Data layers and zero-cost hosting

Date: 2026-10-06 · Status: accepted

## Decision

Three data layers, kept apart:

1. **5etools data**: downloaded at runtime from the 5etools GitHub mirror (or imported from a local
   folder/zip), indexed on the device, never committed anywhere. Disposable.
2. **Homebrew packs**: the user's own entities in 5etools homebrew JSON format; portable.
3. **Campaign data**: vault Markdown, characters, boards, maps, encounters, card sheets. Stores only
   references to 5etools entities (`spell:fireball@xphb`), never copied text.

Hosting: the app code is a **public** repo (`bag-of-holding-2`) deployed free to GitHub Pages. The
user's data lives in a **private** repo (`bag-of-holding-2-data`), synced from every device with Git
(isomorphic-git) and a fine-grained token. Conflicts: last write wins; history keeps the loser.

## Consequences

- A 5etools update can never corrupt user data; unresolvable references go to a Broken links report.
- The public repo must never contain 5etools content or user data.
- All file access goes through the `FileStore` interface (`packages/storage`), with OPFS in browsers
  and a real folder in the desktop app.
