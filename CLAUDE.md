# Bag of Holding 2 — agent guide

A D&D 5e app built on 5etools data: compendium, character builder, DM boards, maps, encounters,
campaign vault, card printing and clickable dice. It runs as an installable offline web app (phone,
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
packages/storage/      FileStore interface + memory / OPFS / Tauri implementations
docs/adr/              architecture decision records
```

Packages still to come, per the plan: `data5e`, `renderer`, `rules`, `dice`, `vault`.

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
6. **Offline first.** No runtime CDN requests for code, fonts or styles; everything is bundled and
   precached by the service worker.

## UI conventions

- Colours only through tokens (`bg-surface`, `text-muted`, `bg-accent`, `bg-header`…, defined in
  `packages/ui/src/styles/tokens.css`). No hex values in components. Every token has a dark value.
- Fonts: `font-sans` (Inter) for UI, `font-serif` (Merriweather) for headings and section headers.
- In-app links use `AppLink` / `useAppNavigate` so Ctrl/middle-click opens an app tab.
- Every page must work at 375 px wide (phone) and with touch.
- Interactive elements need accessible names; e2e tests select by role and name.
- Per-device preferences (theme, tabs, sidebar) may use localStorage via zustand `persist`.
  Anything that should sync between devices goes in the data repo instead (from M4).

## Adding a module page

1. Add or update its entry in `apps/web/src/app/nav.ts`.
2. Create `apps/web/src/features/<module>/` with the page component.
3. Point `apps/web/src/routes/<module>.tsx` at it.
4. Add an e2e spec for the main flow.

## Git

Work on a branch, small commits, open a PR to `main`. CI must be green to merge.
