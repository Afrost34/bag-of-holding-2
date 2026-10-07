import { beforeEach, describe, expect, it } from 'vitest';
import {
  DirectoryNotEmptyError,
  IsADirectoryError,
  NotADirectoryError,
  type FileStore,
} from './types';
import { InvalidPathError } from './path';

/**
 * Behaviour every FileStore must share. Run it against each implementation:
 *   describeFileStoreContract('memory', async () => new MemoryFileStore());
 */
export function describeFileStoreContract(name: string, makeStore: () => Promise<FileStore>) {
  describe(`FileStore contract: ${name}`, () => {
    let store: FileStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    it('returns null for missing files', async () => {
      expect(await store.readFile('missing.txt')).toBeNull();
      expect(await store.readText('a/b/missing.txt')).toBeNull();
      expect(await store.stat('missing.txt')).toBeNull();
    });

    it('round-trips text and bytes, creating parent directories', async () => {
      await store.writeFile('campaigns/rust/vault/index.md', '# Rust & Sunfire\nÉté ☀');
      expect(await store.readText('campaigns/rust/vault/index.md')).toBe('# Rust & Sunfire\nÉté ☀');
      expect(await store.stat('campaigns/rust')).toBe('directory');

      const bytes = new Uint8Array([0, 1, 2, 255]);
      await store.writeFile('bin/data.bin', bytes);
      expect(Array.from((await store.readFile('bin/data.bin')) ?? [])).toEqual([0, 1, 2, 255]);
    });

    it('overwrites existing files', async () => {
      await store.writeFile('note.md', 'first');
      await store.writeFile('note.md', 'second');
      expect(await store.readText('note.md')).toBe('second');
    });

    it('treats equivalent paths the same', async () => {
      await store.writeFile('/a//b/./c.txt', 'x');
      expect(await store.readText('a/b/c.txt')).toBe('x');
      expect(await store.readText('a\\b\\c.txt')).toBe('x');
    });

    it('rejects paths that escape the root', async () => {
      await expect(store.writeFile('../outside.txt', 'x')).rejects.toBeInstanceOf(InvalidPathError);
      await expect(store.readFile('a/../../b')).rejects.toBeInstanceOf(InvalidPathError);
    });

    it('lists immediate children sorted by name', async () => {
      await store.writeFile('dir/b.md', 'b');
      await store.writeFile('dir/a.md', 'a');
      await store.writeFile('dir/sub/c.md', 'c');
      const entries = await store.list('dir');
      expect(entries).toEqual([
        { name: 'a.md', path: 'dir/a.md', kind: 'file' },
        { name: 'b.md', path: 'dir/b.md', kind: 'file' },
        { name: 'sub', path: 'dir/sub', kind: 'directory' },
      ]);
    });

    it('lists the root and returns [] for missing directories', async () => {
      await store.writeFile('top.md', 't');
      expect((await store.list('')).map((e) => e.name)).toContain('top.md');
      expect(await store.list('nope')).toEqual([]);
      expect(await store.stat('')).toBe('directory');
    });

    it('creates empty directories', async () => {
      await store.mkdir('empty/nested');
      expect(await store.stat('empty/nested')).toBe('directory');
      expect(await store.list('empty/nested')).toEqual([]);
      await store.mkdir('empty/nested');
    });

    it('refuses to treat files as directories and vice versa', async () => {
      await store.writeFile('file.md', 'x');
      await expect(store.writeFile('file.md/child.md', 'y')).rejects.toBeInstanceOf(
        NotADirectoryError,
      );
      await expect(store.list('file.md')).rejects.toBeInstanceOf(NotADirectoryError);
      await store.mkdir('folder');
      await expect(store.writeFile('folder', 'x')).rejects.toBeInstanceOf(IsADirectoryError);
    });

    it('removes files and directories', async () => {
      await store.writeFile('x/one.md', '1');
      await store.writeFile('x/y/two.md', '2');
      await store.remove('x/one.md');
      expect(await store.stat('x/one.md')).toBeNull();

      await expect(store.remove('x')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
      await store.remove('x', { recursive: true });
      expect(await store.stat('x')).toBeNull();
      expect(await store.stat('x/y/two.md')).toBeNull();

      await store.remove('never-existed');
    });

    it('knows when files were last written', async () => {
      expect(await store.modified('missing.md')).toBeNull();
      const before = Date.now();
      await store.writeFile('dated/a.md', 'a');
      const time = await store.modified('dated/a.md');
      expect(time).not.toBeNull();
      // File systems round times; allow a couple of seconds either way.
      expect(Math.abs((time ?? 0) - before)).toBeLessThan(5000);
      expect(await store.modified('dated')).toBeNull();
    });

    it('keeps sibling paths with shared prefixes separate', async () => {
      await store.writeFile('notes/a.md', 'a');
      await store.writeFile('notes-old/a.md', 'old');
      await store.remove('notes', { recursive: true });
      expect(await store.readText('notes-old/a.md')).toBe('old');
    });
  });
}
