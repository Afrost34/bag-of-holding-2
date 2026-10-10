# Bag of Holding 2 — agent guide

A D&D 5e app built on 5etools data: compendium, character builder, DM boards, maps, encounters,
campaign journal, card printing and clickable dice. It runs as an installable offline web app (phone,
tablet, PC) and as a Tauri desktop app from one codebase.

The owner does not write code. Agents build everything; the owner reviews a running build at the
end of each milestone. Write code another agent can pick up cold.

**The plan is the source of truth:** https://claude.ai/code/artifact/68aca8ef-26de-4fe0-905a-673e5b773854
(milestones, scope, decisions). Decisions are also recorded in `docs/adr/`. Do not re-argue a
decided point; if one must change, write a new ADR that supersedes the old one.

## Commands

```bash
pnpm install          # once
pnpm dev              # web app at http://localhost:5173
pnpm desktop:dev      # desktop app (needs Rust)
pnpm check            # format + lint + typecheck + boundaries + unit tests — run before every commit
pnpm e2e              # Playwright against the production build
pnpm data:fetch       # download the pinned 5etools release into .data/ (for conformance tests)
pnpm conformance      # only the suites that run on the real 5etools data (needs data:fetch)
pnpm format           # fix formatting
```

A change is done only when `pnpm check` and `pnpm e2e` pass. Never skip, disable or weaken a check
to get green; fix the cause.

## Layout

```
apps/web/              the app (React + Vite + TanStack Router, hash history)
  src/app/             shell: navigation, tabs, theme, platform, AppLink
  src/features/<x>/    one folder per module; features never import each other
  src/routes/          file-based routes, thin: they only mount a feature component
  e2e/                 Playwright specs
apps/desktop/          Tauri 2 shell (Rust); no app logic lives here
packages/ui/           design tokens (tokens.css) and shared components
packages/storage/      FileStore interface + memory / OPFS / Tauri implementations; sync with the data repo (ADR 0006)
packages/data5e/       5etools download, extraction, keys, _copy resolution, SQLite index
packages/dice/         dice notation parser + secure roller (pure TypeScript)
packages/renderer/     5etools entries, {@tags} and entity views → React (no app knowledge)
packages/journal/      campaign notes: wikilinks, tags, frontmatter, link resolution (pure TypeScript)
packages/rules/        character engine: what 5etools entities grant and ask, decisions → sheet (pure)
docs/adr/              architecture decision records
```

The rules engine reads choices from 5etools fields, from Foundry `entryData` (data/class/foundry.json,
kept as aux data) and from hand-written patches (`packages/rules/src/patches.ts`). Its conformance
suite lists class features whose choices exist only as text; review that list when bumping 5etools.

The renderer never navigates, rolls or loads data itself: the app supplies `RendererServices`
(links with hover previews, roll chips, embedded entities, image URLs) in
`apps/web/src/app/renderer/services.tsx`. Anything that renders 5etools text goes through
`<Entries>` / `<RichText>` / `<EntityView>` so links and rolls work everywhere. See ADR 0004.

The 5etools index lives in a Web Worker (`apps/web/src/app/data/data.worker.ts`); the UI talks to
it through `DataWorkerApi` (`protocol.ts`) via Comlink. Never query SQLite from the main thread.
See ADR 0003 for how the index is built.

User data (characters, card sheets, boards, encounters, maps, the stamp library, the campaign
calendar) lives in stores
under `apps/web/src/app/<kind>/`: a pure `model.ts` with its tests (paths, parse/serialize, every
change as a function) and a zustand `store.ts` built on the shared `app/docStore.ts` (undo through
`app/history.ts`) that writes each file on change, in `<kind>/` or
`campaigns/<c>/<kind>/`, and is reloaded after a sync (`app/sync/store.ts`). Code two features
share (the journal's note views, the compendium search box, print cards) moves to `app/`, since
features never import each other. The map canvas (`app/maps/scene.ts`) is PixiJS outside
React and draws only on change. Desktop windows, outside links and updates are in
`apps/desktop/src-tauri/src/lib.rs` (ADR 0007). `e2e/a11y.spec.ts` runs axe over the main pages
in light and dark: keep it green (text needs 4.5:1; use `text-accent-ink`, not `text-accent`, for
accent-coloured text).

## Hard rules

1. **No 5etools data in git, ever.** It is downloaded at runtime. Tests that need it download a
   pinned version into a gitignored cache.
2. **User data stores references, never copies of 5etools text.** Reference format:
   `type:name@source`, e.g. `spell:fireball@xphb`.
3. **Boundaries are enforced** by `.dependency-cruiser.cjs`: packages never import apps; storage has
   no React; Tauri APIs only in `packages/storage/src/tauri.ts` and `apps/desktop` (the web app loads
   that file with a dynamic import); feature folders don't import each other. Add a rule when you add
   a layer.
4. **TypeScript strict, no `any`.** Prefer pure functions with unit tests for logic (see
   `apps/web/src/app/tabs/model.ts` + its test), and keep React components thin.
5. **Every FileStore implementation passes `contract.testkit.ts`.** Extend the contract when you
   add behaviour.
6. **Conformance suites run on real data.** `packages/data5e/src/*conformance*.test.ts` process
   the whole pinned 5etools release. When bumping `PINNED_5ETOOLS_VERSION`, fix what they report;
   never loosen them.
7. **Offline first.** No runtime CDN requests for code, fonts or styles; everything is bundled and
   precached by the service worker.

## UI conventions

- Colours only through tokens (`bg-surface`, `text-muted`, `bg-accent`, `bg-header`…, defined in
  `packages/ui/src/styles/tokens.css`). No hex values in components. Every token has a dark value.
- Fonts: `font-sans` (Inter) for UI, `font-serif` (Merriweather) for headings and section headers.
- In-app links use `AppLink` / `useAppNavigate` so Ctrl/middle-click opens an app tab.
- Every page must work at 375 px wide (phone) and with touch.
- Never `window.confirm`/`alert`/`prompt`: ask with `askConfirm` (`app/confirm.ts`), shown in the app.
- Interactive elements need accessible names; e2e tests select by role and name.
- Per-device preferences (theme, tabs, sidebar) may use localStorage via zustand `persist`.
  Anything that should sync between devices goes in the data repo instead (from M4).

## Adding a module page

1. Add or update its entry in `apps/web/src/app/nav.ts`.
2. Create `apps/web/src/features/<module>/` with the page component.
3. Point `apps/web/src/routes/<module>.tsx` at it.
4. Add an e2e spec for the main flow.

## Where to look first

| Task                                | Start in                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| A character choice is missing/wrong | `packages/rules/src/patches.ts` (by feature name), then `extract/*.ts`                           |
| Sheet numbers (AC, saves, spells)   | `packages/rules/src/sheet.ts`; the worker assembles the view in `data.worker.ts`                 |
| Character builder steps             | `apps/web/src/features/characters/*Step.tsx`, choices via `ChoiceControl`                        |
| Printed character sheet             | `features/characters/print/` (`PrintSheet`, `usePrintData`, `sections.ts`)                       |
| Board widgets (NPC, names, cards…)  | `app/boards/model.ts` (kinds), `features/boards/widgetBodies.tsx`, `addOptions.ts`               |
| A store for a new kind of user file | copy `app/tables/` (model + test + store); register reload in `app/sync/store.ts`                |
| Sync                                | `packages/storage/src/sync/engine.ts`; app side `app/sync/store.ts`, `app/userStore.ts`          |
| Shell: sidebar, tabs, right-click   | `app/shell/` (`contextMenuModel.ts` is the pure part)                                            |
| Small text formats (`+2`, `3rd`)    | `app/format.ts` — reuse, don't copy                                                              |
| A map tool (Creator or Viewer)      | `features/maps/tools.ts` (tool lists, groups), `MapEditor.tsx` (pointer), a `*Panel.tsx`         |
| A new kind of map item              | `app/maps/model.ts` (type + KINDS), `scene.ts` (`drawItem`, `hit`, `select`), `ItemSettings.tsx` |
| Map generators and their rules      | pure modules in `app/maps/`: `scatter`, `city`, `rooms`, `islandgen`, `elevation` (all tested)   |
| Stamp packs (zips)                  | `app/maps/zip.ts`, `packs.ts`, `packModel.ts`; browser in `features/maps/PackBrowser.tsx`        |
| Lights, shadows, ambient light      | `app/maps/lighting.ts` (pure), `drawLighting` in `scene.ts`, `features/maps/LightPanel.tsx`      |
| Path ends, loops, compass, frame    | `app/maps/pathEnds.ts`, `decor.ts`; contour lines and rivers in `elevation.ts`                   |

## Maps (ADR 0010, 0011, 0012)

One map file, two modes: `#/maps/<id>` is the **Viewer** (pins, routes, measure, fog, variants, range
templates, search) and `#/maps/<id>/edit` the **Creator** (stamps, brushes, terrain shapes, roads and
rivers, scatter, districts, buildings, rooms and doors, elevation, labels). `MapEditor` serves both with a
`mode`; `toolsFor(kind, mode)` picks the tools. The map format is v2 (`parseMap` upgrades v1 in place:
background and pictures become picture layers and variants). Procedural things (scatter, districts,
furniture) are items made from a seed and re-made when what they react to changes (`obstacleSignature`);
"bake" turns them into loose stamps/buildings. The Creator keeps a flat picture of the art
(`render`, made by `render.ts`) so phones without the stamp packs show the map. Asset packs are zips copied
into `map-assets/` (OPFS) and read in place; they are never synced. Stamps are named `pack:<id>:<path>` or
`glyph:<name>` (drawn in code). Dungeondraft parity decisions (soft vector terrain, one canvas for light, the
hotbar, edit points everywhere) are in ADR 0012; `docs/research/dungeondraft.md` lists what is not done.

## Pitfalls already met

- `pnpm e2e` runs on the production build. Playwright reuses a preview server that is already
  running locally, which can serve an old build: stop it (or run `pnpm build`) before trusting
  a screenshot.
- Tailwind breakpoints follow the window, not the page: with the sidebar open a `md:` layout
  can be too narrow. Use container queries (`@container` + `@4xl:`) for page-internal columns.
- Characters kept in a campaign live in `campaigns/<id>/characters/`, not `characters/`; their
  rules (2014/2024) come from the campaign. e2e helpers: `createCampaign(page, name, '2014 rules')`.
- Write user files through `userStore()` (it counts writes so the sync can skip quiet runs);
  only the sync itself uses `syncedStore()`.
- Conformance suites run inside `pnpm check` only when `pnpm data:fetch` has filled `.data/`.
  Run them before touching `packages/rules` or `packages/data5e`.
- The accessibility test checks light and dark: ability colours (`--boh-str`…) are light in
  dark mode, so use them for text and borders, never as a fill under white text.
- Composite map items (shapes, paths, scatter, districts, rooms) must not be culled (`cullable = false`
  in `scene.ts`): Pixi computes their bounds late and hides them. Rooms put their walls under, and their
  doors over, every other item of the layer (`Node.extras`).
- Do not write patch scripts with regexes for source edits; use the Edit tool (prettier reformats lines).
- The board canvas renders every node (`onlyRenderVisibleElements={false}`): turning culling on
  re-sorts the DOM on every pan and made large boards lag.

## Git

Work on a branch, small commits, open a PR to `main`. CI must be green to merge.
