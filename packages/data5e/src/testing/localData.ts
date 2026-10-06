import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The pinned 5etools version used by conformance tests. Bump deliberately, then fix whatever
 * the conformance suite reports. Download with `pnpm data:fetch`.
 */
export const PINNED_5ETOOLS_VERSION = 'v2.36.1';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

export const localDataDir = join(repoRoot, '.data', '5etools', PINNED_5ETOOLS_VERSION);

/**
 * Whether the pinned data is on disk. CI sets REQUIRE_5ETOOLS_DATA so a failed download fails
 * the build instead of silently skipping the conformance suites.
 */
export function hasLocalData(): boolean {
  const present = existsSync(join(localDataDir, 'data', 'books.json'));
  if (!present && process.env.REQUIRE_5ETOOLS_DATA === 'true') {
    throw new Error(`5etools ${PINNED_5ETOOLS_VERSION} data missing: run pnpm data:fetch`);
  }
  return present;
}

/** Every file under data/, as repo-relative POSIX paths. */
export function listLocalDataFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
    );
  return walk(join(localDataDir, 'data'))
    .map((file) => relative(localDataDir, file).split(sep).join('/'))
    .sort();
}

export function readLocalJson(path: string): unknown {
  return JSON.parse(readFileSync(join(localDataDir, path), 'utf8'));
}

export function readLocalText(path: string): string {
  return readFileSync(join(localDataDir, path), 'utf8');
}
