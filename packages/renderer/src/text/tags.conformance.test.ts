/**
 * Every tag in the pinned 5etools data is understood, and entity links resolve to indexed
 * entities. Skipped without local data (`pnpm data:fetch`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EntityIndex, installData, LocalDataSource } from '@boh/data5e';
import { openMemoryDatabase } from '@boh/data5e/sqlite';
import {
  hasLocalData,
  listLocalDataFiles,
  localDataDir,
  PINNED_5ETOOLS_VERSION,
  readLocalJson,
} from '@boh/data5e/testing/local';
import { beforeAll, describe, expect, it } from 'vitest';
import { splitTags } from './splitTags';
import { describeTag, type TagModel } from './tags';

interface Found {
  name: string;
  body: string;
  model: TagModel;
}

function collectTags(): Found[] {
  const out: Found[] = [];
  const visitString = (s: string): void => {
    for (const seg of splitTags(s)) {
      if (seg.kind !== 'tag') continue;
      const model = describeTag(seg.name, seg.body);
      out.push({ name: seg.name, body: seg.body, model });
      // Tags nest: formatting content and link display text can hold more tags.
      visitString(seg.body);
    }
  };
  const visit = (v: unknown): void => {
    if (typeof v === 'string') visitString(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  for (const file of listLocalDataFiles()) {
    if (/foundry|makebrew|converter|renderdemo|changelog|generated/.test(file)) continue;
    visit(readLocalJson(file));
  }
  return out;
}

describe.runIf(hasLocalData())('tag conformance', () => {
  let tags: Found[];
  let index: EntityIndex;

  beforeAll(async () => {
    tags = collectTags();
    index = EntityIndex.open(await openMemoryDatabase());
    const paths = [...listLocalDataFiles(), 'js/parser.js'];
    await installData(
      index,
      new LocalDataSource(
        paths.map((p) => [p, new Uint8Array(readFileSync(join(localDataDir, p)))]),
        PINNED_5ETOOLS_VERSION,
      ),
    );
  }, 300_000);

  it('understands every tag', () => {
    const unknown = new Map<string, number>();
    for (const t of tags) {
      if (t.model.kind === 'unknown') unknown.set(t.name, (unknown.get(t.name) ?? 0) + 1);
    }
    expect(Object.fromEntries(unknown)).toEqual({});
    expect(tags.length).toBeGreaterThan(200_000);
  });

  it('resolves entity links', () => {
    const links = tags.filter((t) => t.model.kind === 'entity');
    const unresolved = new Map<string, { n: number; example: string }>();
    let resolved = 0;
    for (const t of links) {
      if (t.model.kind !== 'entity') continue;
      if (index.resolveCandidates(t.model.candidates)) {
        resolved++;
        continue;
      }
      const entry = unresolved.get(t.name) ?? { n: 0, example: `{@${t.name} ${t.body}}` };
      entry.n++;
      unresolved.set(t.name, entry);
    }
    const rate = resolved / links.length;
    console.warn(
      `Entity links: ${String(links.length)}, resolved ${(rate * 100).toFixed(2)}%`,
      Object.fromEntries([...unresolved].sort((a, b) => b[1].n - a[1].n)),
    );
    // Known gaps: generated magic item variants (+1 longsword…) and a few broken upstream links.
    expect(rate).toBeGreaterThan(0.995);
  }, 60_000);
});
