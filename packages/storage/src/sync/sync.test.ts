import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryFileStore } from '../memory';
import { fetchLazyFile, syncStore } from './engine';
import { planSync, resolveConflict } from './plan';
import { blobSha, type RemoteHead, type RemoteRepo } from './remote';

/** A Git repository in memory: blobs, trees and commits, with a branch that moves forward. */
class MemoryRepo implements RemoteRepo {
  blobs = new Map<string, Uint8Array>();
  trees = new Map<string, Record<string, string>>();
  commits = new Map<string, { message: string; tree: string; parents: string[]; time: number }>();
  branch: string | null = null;
  private next = 0;
  /** Simulates another device pushing just before this one moves the branch. */
  beforeMove: (() => Promise<void>) | null = null;

  private id(prefix: string) {
    this.next++;
    return `${prefix}${String(this.next)}`;
  }

  head(): Promise<RemoteHead | null> {
    if (!this.branch) return Promise.resolve(null);
    const c = this.commits.get(this.branch);
    return Promise.resolve(c ? { commit: this.branch, tree: c.tree } : null);
  }

  async init(): Promise<void> {
    const readme = await this.writeBlob(new TextEncoder().encode('# data\n'));
    const tree = this.id('t');
    this.trees.set(tree, { 'README.md': readme });
    this.branch = await this.writeCommit('start', tree, []);
  }

  tree(sha: string): Promise<Record<string, string>> {
    return Promise.resolve({ ...(this.trees.get(sha) ?? {}) });
  }

  readBlob(sha: string): Promise<Uint8Array> {
    const bytes = this.blobs.get(sha);
    if (!bytes) throw new Error(`no blob ${sha}`);
    return Promise.resolve(bytes);
  }

  async writeBlob(bytes: Uint8Array): Promise<string> {
    const sha = await blobSha(bytes);
    this.blobs.set(sha, bytes);
    return sha;
  }

  writeTree(base: string, changes: { path: string; sha: string | null }[]): Promise<string> {
    const files = new Map(Object.entries(this.trees.get(base) ?? {}));
    for (const c of changes) {
      if (c.sha === null) files.delete(c.path);
      else files.set(c.path, c.sha);
    }
    const id = this.id('t');
    this.trees.set(id, Object.fromEntries(files));
    return Promise.resolve(id);
  }

  writeCommit(message: string, tree: string, parents: string[]): Promise<string> {
    const id = this.id('c');
    this.commits.set(id, { message, tree, parents, time: Date.now() });
    return Promise.resolve(id);
  }

  async moveBranch(commit: string, expected: string): Promise<boolean> {
    if (this.beforeMove) {
      const run = this.beforeMove;
      this.beforeMove = null;
      await run();
    }
    if (this.branch !== expected) return false;
    this.branch = commit;
    return true;
  }

  /** When the file last changed: walks back from the branch, like `git log -1 -- path`. */
  lastChange(path: string): Promise<number | null> {
    let id = this.branch;
    while (id) {
      const c = this.commits.get(id);
      if (!c) break;
      const parent = c.parents[0];
      const before = parent ? this.trees.get(this.commits.get(parent)?.tree ?? '') : undefined;
      if (this.trees.get(c.tree)?.[path] !== before?.[path]) return Promise.resolve(c.time);
      id = parent ?? null;
    }
    return Promise.resolve(null);
  }

  /** The text of a file at the branch, or in a given commit. */
  async text(path: string, commit = this.branch): Promise<string | null> {
    const tree = this.trees.get(this.commits.get(commit ?? '')?.tree ?? '');
    const sha = tree?.[path];
    return sha ? new TextDecoder().decode(await this.readBlob(sha)) : null;
  }
}

const options = (device: string) => ({ remoteId: 'me/data@main', device });

afterEach(() => {
  vi.useRealTimers();
});

describe('sync plan', () => {
  it('copies one-sided changes and flags two-sided ones', () => {
    const plan = planSync(
      { same: '1', mine: '1', theirs: '1', both: '1', gone: '1', goneThere: '1' },
      { same: '1', mine: '2', theirs: '1', both: '2', goneThere: '1', added: '9' },
      { same: '1', mine: '1', theirs: '3', both: '3', gone: '1' },
    );
    expect(plan).toEqual({
      download: ['theirs'],
      upload: ['added', 'mine'],
      deleteLocal: ['goneThere'],
      deleteRemote: ['gone'],
      conflicts: ['both'],
    });
  });

  it('never lets a deletion beat an edit; otherwise the newer edit wins', () => {
    expect(resolveConflict({ exists: false, time: 9 }, { exists: true, time: 1 })).toBe('remote');
    expect(resolveConflict({ exists: true, time: 1 }, { exists: false, time: 9 })).toBe('local');
    expect(resolveConflict({ exists: true, time: 5 }, { exists: true, time: 4 })).toBe('local');
    expect(resolveConflict({ exists: true, time: 4 }, { exists: true, time: 5 })).toBe('remote');
  });

  it('hashes content as Git does', async () => {
    expect(await blobSha(new TextEncoder().encode('hello\n'))).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a',
    );
  });
});

describe('sync between two devices', () => {
  it('sends an edit made on the phone to the PC', async () => {
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    const phone = new MemoryFileStore();
    await pc.writeFile('campaigns/a/journal/Rustcrown.md', 'The rusted city.');
    await pc.writeFile('campaigns/a/journal/_assets/map.png', new Uint8Array([1, 2, 3]));

    const first = await syncStore(pc, repo, options('PC'));
    expect(first.uploaded.sort()).toEqual([
      'campaigns/a/journal/Rustcrown.md',
      'campaigns/a/journal/_assets/map.png',
    ]);
    expect(first.downloaded).toEqual(['README.md']);

    const fromScratch = await syncStore(phone, repo, options('phone'));
    expect(fromScratch.downloaded).toHaveLength(3);
    expect(await phone.readFile('campaigns/a/journal/_assets/map.png')).toEqual(
      new Uint8Array([1, 2, 3]),
    );

    await phone.writeFile('campaigns/a/journal/Rustcrown.md', 'The rusted city, on the sea.');
    const fromPhone = await syncStore(phone, repo, options('phone'));
    expect(fromPhone.uploaded).toEqual(['campaigns/a/journal/Rustcrown.md']);
    expect(fromPhone.commit).not.toBeNull();

    const onPc = await syncStore(pc, repo, options('PC'));
    expect(onPc.downloaded).toEqual(['campaigns/a/journal/Rustcrown.md']);
    expect(await pc.readText('campaigns/a/journal/Rustcrown.md')).toBe(
      'The rusted city, on the sea.',
    );

    // Nothing left to do on either side.
    const again = await syncStore(pc, repo, options('PC'));
    expect(again).toMatchObject({ downloaded: [], uploaded: [], commit: null });
  });

  it('passes deletions on, but never deletes an edit', async () => {
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    const phone = new MemoryFileStore();
    await pc.writeFile('a.md', 'a');
    await pc.writeFile('b.md', 'b');
    await syncStore(pc, repo, options('PC'));
    await syncStore(phone, repo, options('phone'));

    await phone.remove('a.md');
    await phone.remove('b.md');
    await pc.writeFile('b.md', 'b, edited on the PC');
    await syncStore(phone, repo, options('phone'));
    const result = await syncStore(pc, repo, options('PC'));
    expect(result.deletedHere).toEqual(['a.md']);
    expect(result.conflicts).toEqual([{ path: 'b.md', winner: 'local' }]);
    expect(await repo.text('b.md')).toBe('b, edited on the PC');
  });

  it('keeps the newer of two edits, and the other one in the history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    const phone = new MemoryFileStore();
    await pc.writeFile('note.md', 'v1');
    await syncStore(pc, repo, options('PC'));
    await syncStore(phone, repo, options('phone'));

    vi.setSystemTime(new Date('2026-10-07T11:00:00Z'));
    await pc.writeFile('note.md', 'from the PC');
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    await phone.writeFile('note.md', 'from the phone, later');
    await syncStore(phone, repo, options('phone'));

    const result = await syncStore(pc, repo, options('PC'));
    expect(result.conflicts).toEqual([{ path: 'note.md', winner: 'remote' }]);
    expect(await pc.readText('note.md')).toBe('from the phone, later');
    expect(await repo.text('note.md')).toBe('from the phone, later');
    // The PC's version was committed before the winner came back.
    const head = repo.commits.get(repo.branch ?? '');
    expect(await repo.text('note.md', head?.parents[0])).toBe('from the PC');
  });

  it('starts again when another device pushes at the same moment', async () => {
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    const phone = new MemoryFileStore();
    await syncStore(pc, repo, options('PC'));
    await syncStore(phone, repo, options('phone'));
    await pc.writeFile('pc.md', 'pc');
    await phone.writeFile('phone.md', 'phone');
    repo.beforeMove = async () => {
      await syncStore(phone, repo, options('phone'));
    };
    await syncStore(pc, repo, options('PC'));
    expect(await repo.text('pc.md')).toBe('pc');
    expect(await repo.text('phone.md')).toBe('phone');
    expect(await pc.readText('phone.md')).toBe('phone');
  });

  it('starts afresh for another repository, and never syncs its own bookkeeping', async () => {
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    await pc.writeFile('a.md', 'a');
    await syncStore(pc, repo, options('PC'));
    expect(await repo.text('.sync/state.json')).toBeNull();
    const other = new MemoryRepo();
    const result = await syncStore(pc, other, { remoteId: 'me/other@main', device: 'PC' });
    expect(result.uploaded).toEqual(['a.md']);
  });
});

describe('lazy files (map pictures)', () => {
  const lazy = (device: string) => ({
    ...options(device),
    lazy: (p: string) => p.includes('/assets/'),
  });

  it('are fetched when needed, never taken as deleted, and sync once they are here', async () => {
    const repo = new MemoryRepo();
    const pc = new MemoryFileStore();
    const phone = new MemoryFileStore();
    await pc.writeFile('maps/m1.json', '{"name":"Mine"}');
    await pc.writeFile('maps/assets/mine.webp', new Uint8Array([1, 2, 3]));
    await syncStore(pc, repo, lazy('PC'));

    // The phone gets the map, not its picture; syncing again neither downloads nor deletes it.
    const first = await syncStore(phone, repo, lazy('phone'));
    expect(first.downloaded.sort()).toEqual(['README.md', 'maps/m1.json']);
    expect(await phone.readFile('maps/assets/mine.webp')).toBeNull();
    const again = await syncStore(phone, repo, lazy('phone'));
    expect(again).toMatchObject({ downloaded: [], deletedThere: [], commit: null });

    // Opened: fetched once, and kept.
    expect(await fetchLazyFile(phone, repo, 'me/data@main', 'maps/assets/mine.webp')).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(await phone.readFile('maps/assets/mine.webp')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await fetchLazyFile(phone, repo, 'me/data@main', 'maps/assets/none.webp')).toBeNull();

    // A new picture made on the phone goes up; a changed one comes down where it is kept.
    await phone.writeFile('maps/assets/new.webp', new Uint8Array([9]));
    expect((await syncStore(phone, repo, lazy('phone'))).uploaded).toEqual(['maps/assets/new.webp']);
    await pc.writeFile('maps/assets/mine.webp', new Uint8Array([4, 5]));
    await syncStore(pc, repo, lazy('PC'));
    expect((await syncStore(phone, repo, lazy('phone'))).downloaded).toEqual(['maps/assets/mine.webp']);
    expect(await pc.readFile('maps/assets/new.webp')).toBeNull();
  }); // prettier-ignore
});
