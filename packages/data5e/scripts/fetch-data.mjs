#!/usr/bin/env node
/**
 * Downloads the pinned 5etools release into .data/5etools/<version>/ (gitignored) for the
 * conformance tests. Skips files that are already present with the right size.
 *
 *   pnpm data:fetch
 *
 * Set GITHUB_TOKEN to avoid the unauthenticated API rate limit (CI does).
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const localData = readFileSync(join(here, '..', 'src', 'testing', 'localData.ts'), 'utf8');
const version = /PINNED_5ETOOLS_VERSION = '([^']+)'/.exec(localData)?.[1];
if (!version) throw new Error('PINNED_5ETOOLS_VERSION not found in src/testing/localData.ts');

const REPO = '5etools-mirror-3/5etools-src';
const outDir = join(repoRoot, '.data', '5etools', version);
const headers = process.env.GITHUB_TOKEN
  ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {};

const treeResponse = await fetch(
  `https://api.github.com/repos/${REPO}/git/trees/${version}?recursive=1`,
  { headers },
);
if (!treeResponse.ok) throw new Error(`Tree request failed: ${treeResponse.status}`);
const tree = await treeResponse.json();
const files = tree.tree.filter(
  (e) =>
    e.type === 'blob' &&
    ((e.path.startsWith('data/') && e.path.endsWith('.json')) || e.path === 'js/parser.js'),
);

let next = 0;
let downloaded = 0;
async function worker() {
  while (next < files.length) {
    const file = files[next++];
    const dest = join(outDir, file.path);
    try {
      if (statSync(dest).size === file.size) continue;
    } catch {
      // missing
    }
    const response = await fetch(
      `https://raw.githubusercontent.com/${REPO}/${version}/${file.path}`,
    );
    if (!response.ok) throw new Error(`${file.path}: ${response.status}`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    downloaded++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(
  `5etools ${version}: ${files.length} files present, ${downloaded} downloaded → ${outDir}`,
);
