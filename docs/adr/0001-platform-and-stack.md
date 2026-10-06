# 0001 — Platform and stack

Date: 2026-10-06 · Status: accepted

## Decision

- One TypeScript codebase: React 19 + Vite, served as an installable offline web app (PWA).
- Desktop shell: **Tauri 2** rather than Electron, for an installer about 10× smaller and lower memory
  use on weak laptops. The shell adds native features only (disk folders, windows, updater).
- Routing: TanStack Router with **hash history**, so deep links work on GitHub Pages, in Tauri and
  offline with no server rewrites.
- Styling: Tailwind CSS 4 with design tokens in `packages/ui`; Radix primitives for accessible
  widgets.
- State: zustand. Tests: Vitest (unit) and Playwright (end-to-end, desktop and phone viewports).
- Monorepo: pnpm workspaces. Boundaries enforced with dependency-cruiser.
- TypeScript is pinned to 6.0 because typescript-eslint does not yet support 7.x.

## Consequences

URLs look like `/#/compendium/spells`. The web app must never import Tauri APIs statically.
