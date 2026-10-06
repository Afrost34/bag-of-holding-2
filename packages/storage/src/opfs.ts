import { sortEntries, toBytes, toText } from './encoding';
import { joinPath, normalizePath, segments } from './path';
import {
  DirectoryNotEmptyError,
  IsADirectoryError,
  NotADirectoryError,
  type EntryKind,
  type FileEntry,
  type FileStore,
} from './types';

/**
 * Browser store backed by the Origin Private File System. Used on phones, tablets and any
 * browser install. Everything lives under one top-level directory so several stores
 * (data repo clone, 5etools cache) can share an origin.
 */
export class OpfsFileStore implements FileStore {
  readonly kind = 'opfs';

  private constructor(private readonly root: FileSystemDirectoryHandle) {}

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in navigator.storage
    );
  }

  static async open(rootName: string): Promise<OpfsFileStore> {
    const origin = await navigator.storage.getDirectory();
    const root = await origin.getDirectoryHandle(normalizePath(rootName), { create: true });
    return new OpfsFileStore(root);
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    const handle = await this.fileHandle(path);
    if (!handle) return null;
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readFile(path);
    return bytes ? toText(bytes) : null;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const parts = segments(path);
    const name = parts.pop();
    if (name === undefined) throw new IsADirectoryError('');
    const dir = await this.dirHandle(parts, true);
    if (!dir) throw new NotADirectoryError(parts.join('/'));
    if ((await this.kindOf(dir, name)) === 'directory') throw new IsADirectoryError(path);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(toBytes(data) as Uint8Array<ArrayBuffer>);
    } finally {
      await writable.close();
    }
  }

  async mkdir(path: string): Promise<void> {
    const dir = await this.dirHandle(segments(path), true);
    if (!dir) throw new NotADirectoryError(path);
  }

  async remove(path: string, options: { recursive?: boolean } = {}): Promise<void> {
    const parts = segments(path);
    const name = parts.pop();
    if (name === undefined) {
      // Clearing the root: remove every child.
      for (const entry of await this.list('')) await this.remove(entry.path, { recursive: true });
      return;
    }
    const parent = await this.dirHandle(parts, false);
    if (!parent) return;
    const kind = await this.kindOf(parent, name);
    if (kind === null) return;
    if (kind === 'directory' && options.recursive !== true) {
      const children = await this.list(path);
      if (children.length > 0) throw new DirectoryNotEmptyError(normalizePath(path));
    }
    await parent.removeEntry(name, { recursive: options.recursive === true });
  }

  async stat(path: string): Promise<EntryKind | null> {
    const parts = segments(path);
    const name = parts.pop();
    if (name === undefined) return 'directory';
    const parent = await this.dirHandle(parts, false);
    return parent ? this.kindOf(parent, name) : null;
  }

  async list(path: string): Promise<FileEntry[]> {
    const parts = segments(path);
    if ((await this.stat(path)) === 'file') throw new NotADirectoryError(normalizePath(path));
    const dir = await this.dirHandle(parts, false);
    if (!dir) return [];
    const base = parts.join('/');
    const entries: FileEntry[] = [];
    for await (const [name, handle] of dir.entries()) {
      entries.push({
        name,
        path: joinPath(base, name),
        kind: handle.kind === 'directory' ? 'directory' : 'file',
      });
    }
    return sortEntries(entries);
  }

  private async fileHandle(path: string): Promise<FileSystemFileHandle | null> {
    const parts = segments(path);
    const name = parts.pop();
    if (name === undefined) return null;
    const dir = await this.dirHandle(parts, false);
    if (!dir) return null;
    try {
      return await dir.getFileHandle(name);
    } catch {
      return null;
    }
  }

  private async dirHandle(
    parts: string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    let dir = this.root;
    for (const part of parts) {
      try {
        dir = await dir.getDirectoryHandle(part, { create });
      } catch (error) {
        if (create && error instanceof DOMException && error.name === 'TypeMismatchError') {
          throw new NotADirectoryError(part);
        }
        return null;
      }
    }
    return dir;
  }

  private async kindOf(dir: FileSystemDirectoryHandle, name: string): Promise<EntryKind | null> {
    for await (const [entryName, handle] of dir.entries()) {
      if (entryName === name) return handle.kind === 'directory' ? 'directory' : 'file';
    }
    return null;
  }
}
