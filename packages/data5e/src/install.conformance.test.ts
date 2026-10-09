/**
 * Installs the real, pinned 5etools release into an in-memory index, end to end.
 * Skipped when the data has not been downloaded (`pnpm data:fetch`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { headerKeys, namedEntries } from './books';
import { LocalDataSource } from './dataSource';
import { CATEGORIES, categoryById, SUPPORT_TYPES } from './lists/categories';
import { EntityIndex } from './db/entityIndex';
import { openMemoryDatabase } from './db/sqlite-wasm';
import { installData, type InstallResult } from './installer';
import {
  hasLocalData,
  listLocalDataFiles,
  localDataDir,
  PINNED_5ETOOLS_VERSION,
} from './testing/localData';

// Each test walks the whole 5etools release: allow time on slower CI machines.
vi.setConfig({ testTimeout: 120_000 });

/** Types that are support data rather than things to browse (they appear inside other pages). */
const NOT_BROWSABLE = new Set([
  ...SUPPORT_TYPES,
  // Shown through the book reader and class pages rather than lists.
  'book', 'adventure', 'bookData', 'adventureData', 'classFeature', 'subclassFeature', 'crochetPattern',
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

  it('gives browse lists their cards, columns and splits', () => {
    const rowsOf = (id: string) => {
      const category = categoryById(id);
      if (!category) throw new Error(`no category ${id}`);
      return index.listRows(category);
    };

    const fighter = rowsOf('classes').find((r) => r.key === 'class:fighter@xphb');
    expect(fighter?.card).toMatchObject({
      image: 'classes/XPHB/Fighter.webp',
      tagline: 'A Master of All Arms and Armor',
      facts: [
        ['Primary ability', 'Strength or Dexterity'],
        ['Hit point die', 'D10'],
        ['Saves', 'Strength & Constitution'],
      ],
    });
    const species = rowsOf('species');
    expect(species.every((r) => r.type === 'race')).toBe(true);
    expect(species.filter((r) => r.card?.image).length / species.length).toBeGreaterThan(0.5);

    const fireball = rowsOf('spells').find((r) => r.key === 'spell:fireball@xphb');
    expect(fireball).toMatchObject({
      sub: 'Evocation • V, S, M',
      f: { timeText: '1 Action', attack: 'DEX Save', effect: 'Fire' },
    });
    expect(rowsOf('spells').find((r) => r.key === 'spell:fireball@phb')?.legacy).toBe(true);

    // Items split into equipment and magic items, with nothing lost or doubled.
    const all = rowsOf('items').map((r) => r.key);
    const equipment = rowsOf('equipment');
    const magic = rowsOf('magic-items');
    expect(equipment.some((r) => r.f.magic === true)).toBe(false);
    expect(equipment.length + magic.length).toBe(all.length);
    expect(equipment.find((r) => r.key === 'baseitem:longsword@xphb')?.f.costText).toBe('15 gp');
    // Reprints without a reprintedAs link are still marked Legacy by name.
    const ammo = magic.filter((r) => r.type === 'magicvariant' && r.name === '+1 Ammunition');
    expect(ammo.map((r) => [r.edition, r.legacy === true]).sort()).toEqual([
      ['2014', true],
      ['2024', false],
    ]);

    const backgrounds = rowsOf('backgrounds');
    expect(backgrounds.find((r) => r.key === 'background:acolyte@xphb')?.f.feature).toBe(
      'Feat: Magic Initiate (Cleric)',
    );
    expect(backgrounds.find((r) => r.key === 'background:acolyte@phb')?.f.feature).toBe(
      'Shelter of the Faithful',
    );
  });

  it('assembles class, subclass and species pages with every feature found', () => {
    const fighter = index.classPage('class:fighter@xphb');
    expect(fighter?.features.slice(0, 3).map((f) => [f.level, f.name])).toEqual([
      [1, 'Fighting Style'],
      [1, 'Second Wind'],
      [1, 'Weapon Mastery'],
    ]);
    expect(fighter?.features.find((f) => f.gainSubclass)?.name).toBe('Fighter Subclass');
    expect(fighter?.fluff?.data.images).toBeDefined();
    const subclasses = fighter?.subclasses ?? [];
    expect(subclasses.find((s) => s.key === 'subclass:champion|fighter|xphb@xphb')).toMatchObject({
      name: 'Champion',
      legacy: false,
    });
    // The 2014 Battle Master, offered for the 2024 Fighter, is Legacy next to the 2024 one.
    expect(subclasses.filter((s) => s.name === 'Battle Master').map((s) => s.legacy)).toEqual([
      false,
      true,
    ]);

    // Across every class and subclass, features resolve.
    const missing: string[] = [];
    let total = 0;
    const classes = categoryById('classes');
    if (!classes) throw new Error('no classes category');
    for (const { key } of index.listRows(classes)) {
      const page = index.classPage(key);
      for (const f of page?.features ?? []) {
        total++;
        if (!f.entity) missing.push(f.key);
      }
      for (const sc of page?.subclasses ?? []) {
        for (const f of index.subclassPage(sc.key)?.features ?? []) {
          total++;
          if (!f.entity) missing.push(f.key);
        }
      }
    }
    expect(total).toBeGreaterThan(2000);
    expect(missing).toEqual([]);

    const champion = index.subclassPage('subclass:champion|fighter|xphb@xphb');
    expect(champion?.cls?.key).toBe('class:fighter@xphb');
    expect(champion?.features.map((f) => f.level)).toEqual([3, 7, 10, 15, 18]);

    const elf = index.speciesPage('race:elf@phb');
    expect(elf?.subraces.map((s) => s.name)).toEqual(
      expect.arrayContaining(['High', 'Wood', 'Drow']),
    );
  });

  it('generates specific magic item variants like 5etools', () => {
    const longsword = index.getEntity('item:+1 longsword@dmg');
    expect(longsword?.data).toMatchObject({
      name: '+1 Longsword',
      dmg1: '1d8',
      rarity: 'uncommon',
      baseItem: 'Longsword|PHB',
      genericVariant: { name: '+1 Weapon', source: 'DMG' },
    });
    expect(longsword?.edition).toBe('2014');
    expect(index.getEntity('item:+1 longsword@xdmg')?.data.baseItem).toBe('Longsword|XPHB');
    expect(index.hasKey('item:adamantine breastplate@dmg')).toBe(true);
    expect(index.hasKey('item:vicious greataxe@dmg')).toBe(true);
    // A 2024 variant only applies to 2024 base items.
    expect(index.hasKey('item:+1 longsword|phb@xdmg')).toBe(false);
    const generated = Object.entries(index.countsByType()).find(([t]) => t === 'item')?.[1] ?? 0;
    expect(generated).toBeGreaterThan(4000);
  });

  it('writes out the text items share ({#itemEntry …}) with their own fields', () => {
    const ring = index.getEntity('item:ring of necrotic resistance@xdmg');
    expect(JSON.stringify(ring?.data.entries)).toContain('necrotic damage');
    expect(JSON.stringify(ring?.data.entries)).toContain('jet');
    const left = ['item', 'baseitem', 'magicvariant'].flatMap((type) =>
      index
        .ofType(type)
        .filter((e) => JSON.stringify(e.data.entries ?? []).includes('{#itemEntry'))
        .map((e) => e.key),
    );
    expect(left).toEqual([]);
  });

  it('puts every browsable entity type in a list', () => {
    const listed = new Set(CATEGORIES.flatMap((c) => c.types));
    const unlisted = Object.keys(index.countsByType()).filter(
      (t) => !listed.has(t) && !t.endsWith('Fluff') && !NOT_BROWSABLE.has(t),
    );
    expect(unlisted).toEqual([]);
  });

  it('reaches every table-of-contents section of every book and adventure', () => {
    const missing: string[] = [];
    const missingChapters: string[] = [];
    let checked = 0;
    let headers = 0;
    for (const kind of ['book', 'adventure'] as const) {
      for (const summary of index.library(kind)) {
        const content = index.bookContent(kind, summary.id);
        if (!content) {
          missing.push(`${kind} ${summary.id}: no text`);
          continue;
        }
        content.toc.forEach((chapter, i) => {
          checked++;
          const names = namedEntries(content.chapters[i]);
          if (content.chapters[i] === undefined)
            missingChapters.push(`${summary.id} ch${String(i)}`);
          for (const h of chapter.headers) {
            headers++;
            const keys = headerKeys(h.header);
            const occurrences = names.filter((n) => keys.includes(n)).length;
            if (occurrences <= h.index) missing.push(`${summary.id} ch${String(i)}: "${h.header}"`);
          }
        });
      }
    }
    expect(checked).toBeGreaterThan(1000);
    // Every chapter has text.
    expect(missingChapters).toEqual([]);
    // Section headers: at least 99% point at a named section; the reader falls back to the top
    // of the chapter for the rest (upstream typos such as "Monsters (Z)" with no Z monsters).
    // FRAiF chapter 7 lists the headers of an adventure published separately (FRAiF-TLLOL).
    const sectionMisses = missing.filter((m) => !m.startsWith('FRAiF ch7'));
    expect(sectionMisses.length / headers, sectionMisses.slice(0, 40).join('\n')).toBeLessThan(
      0.01,
    );
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
