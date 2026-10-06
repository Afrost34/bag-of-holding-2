/**
 * Installs the real, pinned 5etools release into an in-memory index, end to end.
 * Skipped when the data has not been downloaded (`pnpm data:fetch`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalDataSource } from './dataSource';
import { CATEGORIES, categoryById } from './lists/categories';
import { EntityIndex } from './db/entityIndex';
import { openMemoryDatabase } from './db/sqlite-wasm';
import { installData, type InstallResult } from './installer';
import {
  hasLocalData,
  listLocalDataFiles,
  localDataDir,
  PINNED_5ETOOLS_VERSION,
} from './testing/localData';

/** Types that are support data rather than things to browse (they appear inside other pages). */
const NOT_BROWSABLE = new Set([
  'book', 'adventure', 'bookData', 'adventureData', 'classFeature', 'subclassFeature',
  'itemEntry', 'itemType', 'itemTypeAdditionalEntries', 'itemGroup', 'monsterTemplate',
  'legendaryGroupTemplate', 'languageScript', 'lifeBackground', 'lifeClass', 'name',
  'encounter', 'encounterShape', 'magicItems', 'artObjects', 'gems', 'hoard', 'individual',
  'dragon', 'raceFeature', 'crochetPattern', 'tableGroup',
]); // prettier-ignore

describe.runIf(hasLocalData())('full 5etools install', () => {
  let index: EntityIndex;
  let result: InstallResult;

  beforeAll(async () => {
    index = EntityIndex.open(await openMemoryDatabase());
    const paths = [...listLocalDataFiles(), 'js/parser.js'];
    const source = new LocalDataSource(
      paths.map((p) => [p, new Uint8Array(readFileSync(join(localDataDir, p)))]),
      PINNED_5ETOOLS_VERSION,
    );
    result = await installData(index, source);
  }, 300_000);

  it('installs cleanly', () => {
    expect(result.issues).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.copyErrors).toEqual([]);
    console.warn(
      `Installed ${String(index.totalEntities())} entities in ${String(result.durationMs)} ms`,
    );
  });

  it('serves resolved entities and search', () => {
    expect(index.search('fireball', { types: ['spell'] }).map((e) => e.source)).toEqual(
      expect.arrayContaining(['PHB', 'XPHB']),
    );
    const lore = index.getEntity('subclass:lore|bard|xphb@xphb');
    expect(lore?.edition).toBe('2024');
    expect(index.getEntity('spell:fireball@xphb')?.data.level).toBe(3);
  });

  it('lists every source with a name', () => {
    const sources = index.listSources();
    expect(sources.length).toBeGreaterThan(150);
    expect(sources.find((s) => s.id === 'XPHB')).toMatchObject({
      name: "Player's Handbook (2024)",
      edition: '2024',
    });
    expect(sources.filter((s) => s.name === s.id).map((s) => s.id)).toEqual(['Generic']);
  });

  it('builds every compendium list quickly, with useful fields', () => {
    for (const category of CATEGORIES) {
      const started = performance.now();
      const rows = index.listRows(category);
      const ms = performance.now() - started;
      expect(rows.length, category.id).toBeGreaterThan(0);
      expect(ms, `${category.id} took ${ms.toFixed(0)} ms`).toBeLessThan(3000);
    }
    const spellsCategory = categoryById('spells');
    const creaturesCategory = categoryById('creatures');
    if (!spellsCategory || !creaturesCategory) throw new Error('categories missing');
    const spells = index.listRows(spellsCategory);
    const withClasses = spells.filter((r) => (r.f.classes as string[]).length > 0).length;
    expect(withClasses / spells.length).toBeGreaterThan(0.8);
    const fireball = spells.find((r) => r.key === 'spell:fireball@xphb');
    expect(fireball?.f.level).toBe(3);
    expect(fireball?.f.school).toBe('Evocation');
    expect(fireball?.f.classes).toContain('Wizard');
    const creatures = index.listRows(creaturesCategory);
    // Summoned spirits and the like legitimately have no CR.
    expect(creatures.filter((r) => r.f.cr === null).length / creatures.length).toBeLessThan(0.05);
  });

  it('puts every browsable entity type in a list', () => {
    const listed = new Set(CATEGORIES.flatMap((c) => c.types));
    const unlisted = Object.keys(index.countsByType()).filter(
      (t) => !listed.has(t) && !t.endsWith('Fluff') && !NOT_BROWSABLE.has(t),
    );
    expect(unlisted).toEqual([]);
  });

  it('is a no-op when re-run with the same files', async () => {
    const paths = [...listLocalDataFiles(), 'js/parser.js'];
    const again = await installData(
      index,
      new LocalDataSource(
        paths.map((p) => [p, new Uint8Array(readFileSync(join(localDataDir, p)))]),
        PINNED_5ETOOLS_VERSION,
      ),
    );
    expect(again.plan.added + again.plan.changed).toBe(0);
  }, 300_000);
});
