import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubDataSource } from './dataSource';
import { EntityIndex } from './db/entityIndex';
import { openMemoryDatabase } from './db/sqlite-wasm';
import { syncHomebrew, HomebrewError, homebrewSources } from './homebrew';
import { installData, META, type InstallProgress } from './installer';
import { makeKey } from './keys';
import { checkReferences } from './references';
import { fixtureFiles, fixtureSource } from './testing/fixtures';

let index: EntityIndex;

beforeEach(async () => {
  index = EntityIndex.open(await openMemoryDatabase());
});

describe('installData', () => {
  it('indexes a fresh install with editions, copies and search', async () => {
    const progress: InstallProgress[] = [];
    const result = await installData(index, fixtureSource(), {
      onProgress: (p) => progress.push(p),
    });

    expect(result.issues).toEqual([]);
    expect(result.copyErrors).toEqual([]);
    expect(index.getMeta(META.version)).toBe('v1.0.0');
    expect(index.getMeta(META.inProgress)).toBeUndefined();
    expect(progress.at(-1)?.phase).toBe('done');

    expect(index.countsByType()).toMatchObject({
      spell: 3,
      monster: 2,
      class: 1,
      subclass: 1,
      classFeature: 1,
      book: 4,
      bookData: 1,
    });
    expect(index.getEntity('spell:fireball@phb')?.edition).toBe('2014');
    expect(index.getEntity('spell:fireball@xphb')?.edition).toBe('2024');
    // Book text keyed by the book's source code, not its content id.
    expect(index.getEntity('bookdata:ps-a@psa')?.source).toBe('PSA');
    // Generated and Foundry files never produce entities.
    expect(index.search('Duplicate')).toEqual([]);
    expect(index.search('Ignored')).toEqual([]);
  });

  it('resolves _copy entities with their mods', async () => {
    await installData(index, fixtureSource());
    const boss = index.getEntity('monster:goblin boss@mm')?.data;
    expect(boss?._copy).toBeUndefined();
    expect(boss?.dex).toBe(14);
    expect(boss?.cr).toBe('1');
    const actions = boss?.action as { name: string; entries: string[] }[];
    expect(actions.map((a) => a.name)).toEqual(['Scimitar', 'Multiattack']);
    // replaceTxt skips text inside {@tags} and rewrites the rest.
    expect(actions[0]?.entries[0]).toBe('{@hit 4} to hit, the boss slashes.');
    // The raw form is kept for re-resolution after updates.
    expect(index.getRaw('monster:goblin boss@mm')?._copy).toBeDefined();
  });

  it('searches by prefix, ignoring case and accents, exact names first', async () => {
    await installData(index, fixtureSource());
    expect(index.search('fire').map((e) => e.key)).toEqual(
      expect.arrayContaining(['spell:fireball@phb', 'spell:fireball@xphb']),
    );
    expect(index.search('GOB')[0]?.name).toBe('Goblin');
    expect(index.search('fire', { sources: ['xphb'] }).map((e) => e.key)).toEqual([
      'spell:fireball@xphb',
    ]);
    expect(index.search('fire', { sources: [] })).toEqual([]);
    expect(index.search('fire', { excludeSources: ['PHB'] }).map((e) => e.key)).toEqual([
      'spell:fireball@xphb',
    ]);
    expect(index.search('bardic', { types: ['classFeature'] })).toHaveLength(1);
  });

  it('builds the source list with names, editions and counts', async () => {
    await installData(index, fixtureSource());
    const sources = index.listSources();
    expect(sources.find((s) => s.id === 'XPHB')).toMatchObject({ edition: '2024', entities: 2 });
    expect(sources.find((s) => s.id === 'PHB')).toMatchObject({ kind: 'book', edition: '2014' });
  });

  it('serves the library and a book with its contents and chapters', async () => {
    await installData(index, fixtureSource());
    expect(index.library('adventure')).toEqual([
      expect.objectContaining({ id: 'LMoP', name: 'Lost Mine of Phandelver', levels: '1–5' }),
    ]);
    const book = index.bookContent('adventure', 'lmop');
    expect(book?.toc.map((c) => c.name)).toEqual(['Introduction', 'Goblin Arrows', 'Phandalin']);
    expect(book?.toc[1]?.headers.map((h) => h.header)).toEqual([
      'Goblin Ambush',
      'Cragmaw Hideout',
    ]);
    expect(book?.chapters).toHaveLength(3);
    expect(index.bookContent('book', 'nope')).toBeUndefined();
  });

  it('updates incrementally and reports broken references with suggestions', async () => {
    await installData(index, fixtureSource());

    const next = fixtureFiles();
    next['data/spells/spells-phb.json'] = { spell: [] }; // Fireball and Magic Missile removed
    delete next['data/class/class-bard.json'];
    const source = fixtureSource(next, 'v1.1.0');
    const read = vi.spyOn(source, 'readFile');

    const result = await installData(index, source);
    expect(result.plan).toMatchObject({
      added: 0,
      changed: 1,
      removed: ['data/class/class-bard.json'],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(index.getMeta(META.version)).toBe('v1.1.0');
    expect(index.hasKey('spell:fireball@phb')).toBe(false);
    expect(index.countsByType().class).toBeUndefined();

    const report = checkReferences(index, [
      { key: 'spell:fireball@phb', usedIn: 'characters/glubs.json' },
      { key: 'spell:magic missile@phb', usedIn: 'characters/glubs.json' },
      { key: 'spell:fireball@xphb', usedIn: 'characters/glubs.json' },
      { key: 'monster:goblin@mm', usedIn: 'campaigns/rust/encounters/ambush.json' },
    ]);
    expect(report.checked).toBe(4);
    expect(report.broken.map((b) => b.key)).toEqual([
      'spell:fireball@phb',
      'spell:magic missile@phb',
    ]);
    expect(report.broken[0]?.suggestions.map((s) => s.key)).toEqual(['spell:fireball@xphb']);
    expect(report.broken[0]?.usedIn).toEqual(['characters/glubs.json']);
    expect(report.broken[1]?.suggestions).toEqual([]);
  });

  it('resumes an interrupted install without re-downloading finished files', async () => {
    const controller = new AbortController();
    const source = fixtureSource();
    let reads = 0;
    const original = source.readFile.bind(source);
    vi.spyOn(source, 'readFile').mockImplementation(async (path) => {
      if (++reads === 5) controller.abort();
      return original(path);
    });
    await expect(
      installData(index, source, { signal: controller.signal, concurrency: 1 }),
    ).rejects.toThrow();
    expect(index.getMeta(META.inProgress)).toBe('v1.0.0');
    const doneBefore = index.fileShas('5etools').size;
    expect(doneBefore).toBeGreaterThan(0);

    const second = fixtureSource();
    const read = vi.spyOn(second, 'readFile');
    const result = await installData(index, second);
    expect(read.mock.calls.length).toBe(result.plan.added + result.plan.changed);
    expect(result.plan.unchanged).toBe(doneBefore);
    expect(index.hasKey('monster:goblin boss@mm')).toBe(true);
  });

  it('re-derives editions when a book date changes', async () => {
    await installData(index, fixtureSource());
    const next = fixtureFiles();
    const books = next['data/books.json'] as { book: { id: string; published: string }[] };
    const mm = books.book.find((b) => b.id === 'MM');
    if (mm) mm.published = '2025-02-18';
    await installData(index, fixtureSource(next, 'v1.2.0'));
    expect(index.getEntity('monster:goblin@mm')?.edition).toBe('2024');
  });
});

describe('homebrew', () => {
  const pack = (spells: object[]) => ({
    _meta: { sources: [{ json: 'MyBrew', full: 'My Brew', abbreviation: 'MB' }] },
    spell: spells,
  });

  it('indexes packs, keeps official content on conflicts, and removes packs', async () => {
    await installData(index, fixtureSource());
    const results = syncHomebrew(index, [
      {
        path: 'homebrew/my-brew.json',
        sha: 'a',
        json: pack([
          { name: 'Frost Lance', source: 'MyBrew', level: 2 },
          { name: 'Fireball', source: 'PHB', level: 9 },
        ]),
      },
    ]);
    expect(results[0]?.entities).toBe(1);
    expect(results[0]?.skipped).toHaveLength(1);
    expect(index.getEntity('spell:fireball@phb')?.data.level).toBe(3);
    expect(index.getEntity(makeKey('spell', ['Frost Lance'], 'MyBrew'))?.layer).toBe('homebrew');
    expect(index.listSources().find((s) => s.id === 'MyBrew')).toMatchObject({
      kind: 'homebrew',
      name: 'My Brew',
      entities: 1,
    });

    syncHomebrew(index, []);
    expect(index.hasKey('spell:frost lance@mybrew')).toBe(false);
    expect(index.hasKey('spell:fireball@phb')).toBe(true);
  });

  it('rejects files that are not homebrew packs', () => {
    expect(() => homebrewSources({ spell: [] })).toThrow(HomebrewError);
    expect(() => homebrewSources({ _meta: { sources: [] } })).toThrow(HomebrewError);
  });
});

describe('GitHubDataSource', () => {
  it('calls fetch as a plain function (browsers reject method-style calls)', async () => {
    const calls: unknown[] = [];
    const strictFetch = function (this: unknown, input: string) {
      calls.push(this);
      return Promise.resolve(
        new Response(input.includes('/git/trees/') ? '{"tree":[],"truncated":false}' : '{}'),
      );
    };
    const source = new GitHubDataSource('owner/repo', 'v1', strictFetch);
    await source.listFiles();
    await source.readFile('data/books.json');
    expect(calls.every((self) => self === undefined)).toBe(true);
  });
});

describe('homebrew copies', () => {
  it('resolves homebrew entities that copy official ones', async () => {
    await installData(index, fixtureSource());
    syncHomebrew(index, [
      {
        path: 'homebrew/goblins.json',
        sha: 'b',
        json: {
          _meta: { sources: [{ json: 'Gob', full: 'Goblin Tribes' }] },
          monster: [
            {
              name: 'Rust Goblin',
              source: 'Gob',
              _copy: {
                name: 'Goblin',
                source: 'MM',
                _mod: { '*': { mode: 'replaceTxt', replace: 'goblin', with: 'rust goblin' } },
              },
            },
          ],
        },
      },
    ]);
    const rust = index.getEntity('monster:rust goblin@gob')?.data;
    expect(rust?.dex).toBe(14);
    expect((rust?.action as { entries: string[] }[])[0]?.entries[0]).toContain('the rust goblin');
  });
});
