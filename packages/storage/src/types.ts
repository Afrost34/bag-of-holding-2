export type EntryKind = 'file' | 'directory';

export interface FileEntry {
  /** Last path segment. */
  name: string;
  /** Full normalized path from the store root. */
  path: string;
  kind: EntryKind;
}

/**
 * A rooted file system. Every implementation (memory, browser OPFS, Tauri disk) must pass
 * the shared contract suite in `contract.testkit.ts`.
 */
export interface FileStore {
  /** Short identifier for logs and diagnostics, e.g. "memory", "opfs", "tauri". */
  readonly kind: string;

  /** File bytes, or `null` when no file exists at `path`. */
  readFile(path: string): Promise<Uint8Array | null>;

  /** File contents decoded as UTF-8, or `null` when no file exists at `path`. */
  readText(path: string): Promise<string | null>;

  /** Creates or replaces a file, creating missing parent directories. */
  writeFile(path: string, data: Uint8Array | string): Promise<void>;

  /** Creates a directory and any missing parents. No-op when it already exists. */
  mkdir(path: string): Promise<void>;

  /**
   * Removes a file or directory. Directories must be empty unless `recursive` is set.
   * No-op when nothing exists at `path`.
   */
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;

  /** What exists at `path`, or `null`. The root (`''`) is always a directory. */
  stat(path: string): Promise<EntryKind | null>;

  /** Immediate children of a directory, sorted by name. Empty when the directory is missing. */
  list(path: string): Promise<FileEntry[]>;
}

export class NotADirectoryError extends Error {
  constructor(path: string) {
    super(`Not a directory: "${path}"`);
    this.name = 'NotADirectoryError';
  }
}

export class DirectoryNotEmptyError extends Error {
  constructor(path: string) {
    super(`Directory not empty: "${path}"`);
    this.name = 'DirectoryNotEmptyError';
  }
}

export class IsADirectoryError extends Error {
  constructor(path: string) {
    super(`Is a directory: "${path}"`);
    this.name = 'IsADirectoryError';
  }
}
