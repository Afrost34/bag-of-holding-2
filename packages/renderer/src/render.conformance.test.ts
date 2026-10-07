/**
 * Renders every entity in the pinned 5etools release (resolved `_copy` forms included) to HTML.
 * Fails on any crash and on any entry type the renderer does not know.
 * Skipped without local data (`pnpm data:fetch`).
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
} from '@boh/data5e/testing/local';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { KNOWN_ENTRY_TYPES } from './react/Entries';
import { EntityView } from './react/entities/EntityView';

// Each test walks the whole 5etools release: allow time on slower CI machines.
vi.setConfig({ testTimeout: 120_000 });

/** Props whose values are entries (lists of strings / entry objects). */
const ENTRY_PROPS = new Set([
  'entries', 'entry', 'items', 'headerEntries', 'footerEntries', 'entriesHigherLevel',
  'additionalEntries', 'trait', 'action', 'bonus', 'reaction', 'legendary', 'mythic', 'variant',
  'data', 'attackEntries', 'hitEntries', 'images', 'blocks', 'tables', 'rows', 'row',
]); // prettier-ignore

/** Collects `type` values of objects found in entry positions. */
function entryTypes(
  value: unknown,
  out: Map<string, string>,
  where: string,
  inEntries = false,
): void {
  if (Array.isArray(value)) {
    for (const v of value) entryTypes(v, out, where, inEntries);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const obj = value as Record<string, unknown>;
  if (inEntries && typeof obj.type === 'string' && !out.has(obj.type)) out.set(obj.type, where);
  for (const [k, v] of Object.entries(obj)) {
    entryTypes(v, out, where, ENTRY_PROPS.has(k) || (inEntries && k === 'entries'));
  }
}

describe.runIf(hasLocalData())('render conformance', () => {
  let index: EntityIndex;

  beforeAll(async () => {
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

  it('knows every entry type in the data', () => {
    const found = new Map<string, string>();
    const keys = index.db.all<{ key: string }>('SELECT key FROM entities');
    for (const { key } of keys) {
      const entity = index.getEntity(key);
      if (entity) entryTypes(entity.data, found, key);
    }
    const unknown = [...found].filter(([type]) => !KNOWN_ENTRY_TYPES.has(type));
    expect(Object.fromEntries(unknown)).toEqual({});
  });

  it('renders every entity without crashing', () => {
    const keys = index.db.all<{ key: string }>('SELECT key FROM entities');
    const failures: string[] = [];
    let rendered = 0;
    for (const { key } of keys) {
      const entity = index.getEntity(key);
      if (!entity) continue;
      try {
        const html = renderToStaticMarkup(
          createElement(EntityView, {
            type: entity.type,
            data: entity.data,
            edition: entity.edition,
          }),
        );
        expect(typeof html).toBe('string');
        rendered++;
      } catch (error) {
        failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(rendered).toBeGreaterThan(24_000);
  }, 600_000);
});
