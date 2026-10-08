# 0007 — Desktop windows, links and updates

Date: 2026-10-08 · Status: accepted

## Context

The desktop app (Tauri 2, ADR 0001) runs the same web build as the installed web app. Three
things need the native shell:

- The **player window** (M9): a board opens a second window with `window.open` and talks to it
  over a `BroadcastChannel`. A Tauri webview ignores `window.open` unless the shell allows it.
- **Links to other sites** (journal links, 5etools credits) must open in the user's browser, not
  inside the app.
- **Updates** (M12): the plan wants the desktop app to update itself.

## Decision

- The main window is made in Rust (`apps/desktop/src-tauri/src/lib.rs`), not in
  `tauri.conf.json`, so it can take an `on_new_window` handler: the app's own pages open as app
  windows (same webview environment, so `BroadcastChannel`, OPFS and the data repo work in both);
  anything else is opened in the system browser (`tauri-plugin-opener`) and denied in the app.
  The capability file applies to every window (`"windows": ["*"]`).
- Updates use **`tauri-plugin-updater`** with GitHub Releases: the app reads
  `releases/latest/download/latest.json` on start; when a newer version is there it asks (native
  dialog, `tauri-plugin-dialog`) and, on yes, downloads, installs and restarts. All of it is in
  Rust: the web app does not call Tauri APIs for this (CLAUDE.md rule 3).
- Releases are **signed**. The public key is in `tauri.conf.json`; the private key lives outside
  the repo and reaches CI as the `TAURI_SIGNING_PRIVATE_KEY` secret. `release-desktop.yml` builds
  update files only when that secret is set (the installer is built either way) and takes the
  version from the tag (`v0.2.0` → `0.2.0`), so installed apps see each release as newer.
- A release starts as a **draft**; publishing it is what makes installed apps offer the update.

## Consequences

- Shipping an update: push a tag `vX.Y.Z` (higher than the last), check the draft release, publish.
- Losing the private key means installed apps cannot verify new releases: they must be reinstalled
  from a release signed with a new key. Keep the key (and a copy of it) safe.
- The web app's own updates are unchanged: the service worker asks before reloading.
