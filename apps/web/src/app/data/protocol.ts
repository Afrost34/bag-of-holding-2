import type {
  BookContent,
  BookKind,
  BookSummary,
  ClassPage,
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
  SpeciesPage,
  SubclassPage,
} from '@boh/data5e';
import type {
  BuiltCharacter,
  CampaignRules,
  CharacterDecisions,
  OptionSummary,
  Sheet,
} from '@boh/rules';

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

/** A character as the rules engine sees it: what it has, what is open, and its sheet. */
export interface CharacterView extends Omit<BuiltCharacter, 'entities'> {
  /** The entities it is built from, without their data. */
  entities: EntitySummary[];
  sheet: Sheet;
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
  /** Every entry of a type (small types only: treasure tables, gemstones…). */
  ofType(type: string): Promise<EntityDetail[]>;
  /** All rows of a compendium list category (every source; filter in the UI). */
  listRows(categoryId: string): Promise<ListRow[]>;
  /** Books or adventures with text, newest first. */
  library(kind: 'book' | 'adventure'): Promise<BookSummary[]>;
  /** Contents and chapters of a book, adventure or the quick reference. */
  bookContent(kind: BookKind, id: string): Promise<BookContent | undefined>;
  /** A class with its features and subclasses; a subclass with its features; a species. */
  classPage(key: string): Promise<ClassPage | undefined>;
  subclassPage(key: string): Promise<SubclassPage | undefined>;
  speciesPage(key: string): Promise<SpeciesPage | undefined>;
  /** The specific items ("+1 Longsword") made from a generic variant ("+1 Weapon"). */
  specificVariants(key: string): Promise<EntitySummary[]>;
  /** For each candidate list, the first key that exists (link resolution). */
  resolve(candidateLists: string[][]): Promise<(string | null)[]>;
  checkReferences(references: { key: string; usedIn: string }[]): Promise<ReferenceReport>;

  /** Runs the rules engine on a character's decisions. */
  character(decisions: CharacterDecisions, rules?: CampaignRules): Promise<CharacterView>;
  /** What an open choice can be answered with (every source; filter in the UI). */
  choiceOptions(
    decisions: CharacterDecisions,
    choiceId: string,
    rules?: CampaignRules,
  ): Promise<OptionSummary[]>;
}
