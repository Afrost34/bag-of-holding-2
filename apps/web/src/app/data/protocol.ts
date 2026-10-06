import type {
  EntityDetail,
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
  /** `persistent`: OPFS database survives reloads. `memory`: this browser lacks OPFS. */
  storage: 'persistent' | 'memory';
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
  checkReferences(references: { key: string; usedIn: string }[]): Promise<ReferenceReport>;
}
