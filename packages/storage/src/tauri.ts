import * as fs from '@tauri-apps/plugin-fs';
import { sortEntries, toBytes, toText } from './encoding';
import { dirname, joinPath, normalizePath } from './path';
import {
  DirectoryNotEmptyError,
  IsADirectoryError,
  NotADirectoryError,
  type EntryKind,
  type FileEntry,
  type FileStore,
} from './types';

/**
 * Desktop store: a real folder on disk, accessed through the Tauri fs plugin.
 * Loaded only inside the desktop shell (import from `@boh/storage/tauri`).
 */
export class TauriFileStore implements FileStore {
  readonly kind = 'tauri';

  /** @param rootDir Absolute path of the folder this store is rooted at. */
  constructor(private readonly rootDir: string) {}

  async readFile(path: string): Promise<Uint8Array | null> {
    const abs = this.abs(path);
    if ((await this.stat(path)) !== 'file') return null;
    return fs.readFile(abs);
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readFile(path);
    return bytes ? toText(bytes) : null;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const p = normalizePath(path);
    if (p === '' || (await this.stat(p)) === 'directory') throw new IsADirectoryError(p);
    await this.mkdir(dirname(p));
    await fs.writeFile(this.abs(p), toBytes(data));
  }

  async mkdir(path: string): Promise<void> {
    const p = normalizePath(path);
    const kind = await this.stat(p);
    if (kind === 'directory') return;
    if (kind === 'file') throw new NotADirectoryError(p);
    // A file anywhere along the way must surface as NotADirectoryError.
    const parent = dirname(p);
    if (parent !== p) await this.mkdir(parent);
    await fs.mkdir(this.abs(p), { recursive: true });
  }

  async remove(path: string, options: { recursive?: boolean } = {}): Promise<void> {
    const p = normalizePath(path);
    const kind = await this.stat(p);
    if (kind === null) return;
    if (p === '') {
      for (const entry of await this.list('')) await this.remove(entry.path, { recursive: true });
      return;
    }
    if (kind === 'directory' && options.recursive !== true && (await this.list(p)).length > 0) {
      throw new DirectoryNotEmptyError(p);
    }
    await fs.remove(this.abs(p), { recursive: options.recursive === true });
  }

  async stat(path: string): Promise<EntryKind | null> {
    const abs = this.abs(path);
    if (!(await fs.exists(abs))) return null;
    const info = await fs.stat(abs);
    return info.isDirectory ? 'directory' : 'file';
  }

  async list(path: string): Promise<FileEntry[]> {
    const p = normalizePath(path);
    const kind = await this.stat(p);
    if (kind === 'file') throw new NotADirectoryError(p);
    if (kind === null) return [];
    const children = await fs.readDir(this.abs(p));
    return sortEntries(
      children.map((child) => ({
        name: child.name,
        path: joinPath(p, child.name),
        kind: child.isDirectory ? ('directory' as const) : ('file' as const),
      })),
    );
  }

  private abs(path: string): string {
    const p = normalizePath(path);
    const root = this.rootDir.replace(/[\\/]+$/, '');
    return p === '' ? root : `${root}/${p}`;
  }
}
