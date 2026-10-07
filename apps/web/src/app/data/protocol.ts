import type {
  BookContent,
  BookKind,
  BookSummary,
  EntityDetail,
  ListRow,
  EntitySummary,
  HomebrewPack,
  HomebrewResult,
  InstallProgress,
  ReferenceReport,
  SearchOptions,
  SourceInfo,
  SourceSummary,
} from '@boh/data5e';

/** Shared between the data worker and the UI. Everything crosses the worker boundary by value. */

export interface DataStatus {
  /**
   * `persistent`: OPFS database survives reloads. `memory`: this browser lacks OPFS.
   * `busy`: the app is open in another tab or window, which owns the database.
   */
  storage: 'persistent' | 'memory' | 'busy';
  installed: boolean;
  version?: string;
  origin?: string;
  installedAt?: string;
  /** Version of an install that was interrupted and can be resumed. */
  interrupted?: string;
  entities: number;
  types: Record<string, number>;
}

export interface InstallSummary {
  version: string;
  added: number;
  changed: number;
  removed: number;
  durationMs: number;
  /** Problems worth showing (unidentified entries, copy failures…). */
  warnings: string[];
}

export interface UpdateCheck {
  latest: string;
  installed?: string;
  updateAvailable: boolean;
}

export interface LocalFile {
  path: string;
  file: Blob;
}

export interface DataWorkerApi {
  status(): Promise<DataStatus>;
  checkForUpdate(repo: string): Promise<UpdateCheck>;
  installFromGitHub(
    repo: string,
    version: string,
    onProgress: (progress: InstallProgress) => void,
  ): Promise<InstallSummary>;
  /** A picked folder (files with their relative paths) or a single .zip. */
  installFromFiles(
    files: LocalFile[],
    onProgress: (progress: InstallProgress) => void,
  ): Promise<InstallSummary>;
  cancelInstall(): void;
  clear(): Promise<void>;

  validateHomebrew(json: unknown): SourceInfo[];
  syncHomebrew(packs: HomebrewPack[]): Promise<HomebrewResult[]>;

  sources(): Promise<SourceSummary[]>;
  search(text: string, options?: SearchOptions): Promise<EntitySummary[]>;
  entity(key: string): Promise<EntityDetail | undefined>;
  /** All rows of a compendium list category (every source; filter in the UI). */
  listRows(categoryId: string): Promise<ListRow[]>;
  /** Books or adventures with text, newest first. */
  library(kind: 'book' | 'adventure'): Promise<BookSummary[]>;
  /** Contents and chapters of a book, adventure or the quick reference. */
  bookContent(kind: BookKind, id: string): Promise<BookContent | undefined>;
  /** Number of entries per list category. */
  categoryCounts(): Promise<Record<string, number>>;
  /** For each candidate list, the first key that exists (link resolution). */
  resolve(candidateLists: string[][]): Promise<(string | null)[]>;
  checkReferences(references: { key: string; usedIn: string }[]): Promise<ReferenceReport>;
}
