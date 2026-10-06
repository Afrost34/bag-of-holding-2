# Bag of Holding

A D&D 5e companion for the DM: a fully linked compendium, a character builder, infinite DM boards,
a map maker, encounters, campaign notes, printable cards and clickable dice. It works offline and
installs on phone, tablet and PC.

Built on data from 5etools, which is downloaded by the app on first launch and is not part of this
repository.

## Develop

Requirements: Node 22+, pnpm 10, and Rust (only for the desktop app).

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm check          # all static checks and unit tests
pnpm e2e            # end-to-end tests
pnpm desktop:build  # Windows installer in apps/desktop/src-tauri/target/release/bundle
```

See [CLAUDE.md](CLAUDE.md) for architecture and conventions, and [docs/adr](docs/adr) for decisions.
