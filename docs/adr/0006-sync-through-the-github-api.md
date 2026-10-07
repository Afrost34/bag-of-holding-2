# 0006 — Sync through the GitHub REST API

Date: 2026-10-07 · Status: accepted · Supersedes the "isomorphic-git" part of 0002

## Context

ADR 0002 keeps the user's data in a private repository (`bag-of-holding-2-data`) synced from every
device with Git, naming isomorphic-git. In a browser (the installed app on phones and tablets)
isomorphic-git cannot talk to GitHub directly: Git's smart-HTTP endpoints send no CORS headers, so
every request would go through a CORS proxy. The free public proxy would see the user's token and
data, and running our own costs money or a server. GitHub's REST API, on the other hand, allows
browser calls and offers the low-level Git objects (blobs, trees, commits, refs).

## Decision

- Sync uses the **GitHub REST "Git data" API** with a fine-grained personal access token limited to
  the data repository (Contents: read and write). Same code in the browser and the desktop app; no
  proxy, no new dependency. Code: `packages/storage/src/sync/` (`GitHubRepo`, `syncStore`).
- Each run compares every file three ways by Git blob hash: as at the last sync (kept in the store
  under `.sync/`, never synced), on this device, and in the repository. One-sided changes are
  copied; this device's changes go up as **one commit** (named after the device); the branch moves
  only if nobody pushed meanwhile, otherwise the run starts again.
- **Conflicts** (both sides changed): a deletion never beats an edit; otherwise the newer edit wins
  (the file's modification time here, its last commit date there). When this device's version
  loses, it is committed first and then replaced, so **the history keeps the loser** as ADR 0002
  requires.
- The token stays in the device's local storage, never in the store, never synced. Connecting
  refuses a public repository.
- Runs: when the app starts, every 3 minutes while visible, when it comes back to the front, when
  the connection returns, and on "Sync now" (the cloud button next to the search).

## Consequences

- `FileStore` gained `modified(path)` (contract-tested) for "the newer edit wins".
- First sync of a large journal makes one request per file (about 700 for the Rust & Sunfire vault),
  well within GitHub's 5,000 requests per hour.
- The repository holds the store as it is (`campaigns/<id>/…`, `templates/`, `homebrew/`,
  `annotations.json`); it can be cloned and read with ordinary Git.
