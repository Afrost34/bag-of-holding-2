import { sortEntries, toBytes, toText } from './encoding';
import { dirname, normalizePath, segments } from './path';
import {
  DirectoryNotEmptyError,
  IsADirectoryError,
  NotADirectoryError,
  type EntryKind,
  type FileEntry,
  type FileStore,
} from './types';

/** Runs synchronous work and reports any throw as a rejected promise, like a real async store. */
function settle<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

/** In-memory store for tests and as a scratch store. */
export class MemoryFileStore implements FileStore {
  readonly kind = 'memory';
  private readonly files = new Map<string, Uint8Array>();
  private readonly dirs = new Set<string>(['']);

  readFile(path: string): Promise<Uint8Array | null> {
    return settle(() => this.files.get(normalizePath(path))?.slice() ?? null);
  }

  readText(path: string): Promise<string | null> {
    return settle(() => {
      const bytes = this.files.get(normalizePath(path));
      return bytes ? toText(bytes) : null;
    });
  }

  writeFile(path: string, data: Uint8Array | string): Promise<void> {
    return settle(() => {
      const p = normalizePath(path);
      if (p === '' || this.dirs.has(p)) throw new IsADirectoryError(p);
      this.mkdirSync(dirname(p));
      this.files.set(p, toBytes(data).slice());
    });
  }

  mkdir(path: string): Promise<void> {
    return settle(() => {
      this.mkdirSync(path);
    });
  }

  remove(path: string, options: { recursive?: boolean } = {}): Promise<void> {
    return settle(() => {
      const p = normalizePath(path);
      if (this.files.delete(p)) return;
      if (!this.dirs.has(p)) return;
      if (this.listSync(p).length > 0 && options.recursive !== true) {
        throw new DirectoryNotEmptyError(p);
      }
      const prefix = p === '' ? '' : `${p}/`;
      for (const key of [...this.files.keys()]) if (key.startsWith(prefix)) this.files.delete(key);
      for (const key of [...this.dirs]) if (key.startsWith(prefix)) this.dirs.delete(key);
      this.dirs.delete(p);
      this.dirs.add('');
    });
  }

  stat(path: string): Promise<EntryKind | null> {
    return settle(() => {
      const p = normalizePath(path);
      if (this.dirs.has(p)) return 'directory';
      if (this.files.has(p)) return 'file';
      return null;
    });
  }

  list(path: string): Promise<FileEntry[]> {
    return settle(() => this.listSync(path));
  }

  private mkdirSync(path: string): void {
    let current = '';
    for (const segment of segments(path)) {
      current = current === '' ? segment : `${current}/${segment}`;
      if (this.files.has(current)) throw new NotADirectoryError(current);
      this.dirs.add(current);
    }
  }

  private listSync(path: string): FileEntry[] {
    const p = normalizePath(path);
    if (this.files.has(p)) throw new NotADirectoryError(p);
    if (!this.dirs.has(p)) return [];
    const entries: FileEntry[] = [];
    const childOf = (key: string) => key !== p && dirname(key) === p;
    for (const key of this.dirs) {
      if (childOf(key)) entries.push({ name: lastSegment(key), path: key, kind: 'directory' });
    }
    for (const key of this.files.keys()) {
      if (childOf(key)) entries.push({ name: lastSegment(key), path: key, kind: 'file' });
    }
    return sortEntries(entries);
  }
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
