import { PARSER_FILE, type DataSource, type RemoteFile } from './dataSource';
import type { EntityIndex } from './db/entityIndex';
import { extractFile, type ExtractIssue } from './extract';
import { parseSourceRegistry } from './sourceRegistry';

export type InstallPhase = 'listing' | 'downloading' | 'linking' | 'done';

export interface InstallProgress {
  phase: InstallPhase;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  currentFile?: string | undefined;
}

export interface InstallPlan {
  added: RemoteFile[];
  changed: RemoteFile[];
  removed: string[];
  unchanged: number;
}

export interface InstallResult {
  version: string;
  plan: Omit<InstallPlan, 'added' | 'changed'> & { added: number; changed: number };
  issues: ExtractIssue[];
  /** Entities skipped because another file already defines their key. */
  skipped: string[];
  /** `_copy` entities that could not be resolved (shown unresolved). */
  copyErrors: string[];
  durationMs: number;
}

export interface InstallOptions {
  onProgress?: (progress: InstallProgress) => void;
  signal?: AbortSignal;
  /** Parallel downloads. */
  concurrency?: number;
}

export const META = {
  version: 'installed_version',
  origin: 'installed_from',
  installedAt: 'installed_at',
  inProgress: 'install_in_progress',
} as const;

/** Files that define editions and source names: applied before everything else. */
const FOUNDATION_FILES = new Set(['data/books.json', 'data/adventures.json', PARSER_FILE]);

export function planInstall(installed: Map<string, string>, remote: RemoteFile[]): InstallPlan {
  const plan: InstallPlan = { added: [], changed: [], removed: [], unchanged: 0 };
  const remotePaths = new Set<string>();
  for (const file of remote) {
    remotePaths.add(file.path);
    const sha = installed.get(file.path);
    if (sha === undefined) plan.added.push(file);
    else if (sha !== file.sha) plan.changed.push(file);
    else plan.unchanged++;
  }
  for (const path of installed.keys()) {
    // Derived files (`$generated/…`) are rebuilt from others, never downloaded.
    if (!remotePaths.has(path) && !path.startsWith('$')) plan.removed.push(path);
  }
  return plan;
}

/**
 * Installs or updates 5etools data from `source` into `index`. Only new or changed files are
 * downloaded, and each file is committed on its own, so an interrupted install resumes where it
 * stopped. User data is never touched: it only holds keys into this index.
 */
export async function installData(
  index: EntityIndex,
  source: DataSource,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const started = Date.now();
  const { onProgress, signal } = options;
  const progress: InstallProgress = {
    phase: 'listing',
    filesDone: 0,
    filesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
  };
  const report = (patch: Partial<InstallProgress> = {}) => {
    Object.assign(progress, patch);
    onProgress?.({ ...progress });
  };
  report();

  const remote = await source.listFiles();
  const plan = planInstall(index.fileShas('5etools'), remote);
  const toFetch = [...plan.added, ...plan.changed];
  report({
    phase: 'downloading',
    filesTotal: toFetch.length,
    bytesTotal: toFetch.reduce((sum, f) => sum + f.size, 0),
  });
  index.setMeta(META.inProgress, source.version);

  const issues: ExtractIssue[] = [];
  const skipped: string[] = [];
  const decoder = new TextDecoder();

  const apply = async (file: RemoteFile, ctx = index.extractContext()) => {
    signal?.throwIfAborted();
    report({ currentFile: file.path });
    const bytes = await source.readFile(file.path, signal);
    signal?.throwIfAborted();
    const text = decoder.decode(bytes);
    if (file.path === PARSER_FILE) {
      index.setRegistry(file.sha, parseSourceRegistry(text));
    } else {
      const result = extractFile(file.path, JSON.parse(text) as unknown, ctx);
      issues.push(...result.issues);
      skipped.push(...index.replaceFile(file.path, file.sha, '5etools', result));
    }
    report({ filesDone: progress.filesDone + 1, bytesDone: progress.bytesDone + file.size });
  };

  // Foundation first, sequentially: later files need their editions and content ids.
  const foundation = toFetch.filter((f) => FOUNDATION_FILES.has(f.path));
  for (const file of foundation) await apply(file);

  const ctx = index.extractContext();
  const rest = toFetch.filter((f) => !FOUNDATION_FILES.has(f.path));
  let next = 0;
  const worker = async () => {
    while (next < rest.length) {
      const file = rest[next++];
      if (file) await apply(file, ctx);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 6 }, worker));

  for (const path of plan.removed) index.removeFile(path);

  report({ phase: 'linking', currentFile: undefined });
  if (foundation.length > 0 && plan.unchanged > 0) index.recomputeEditions(ctx);
  const copyErrors = index.resolveCopies();
  index.regenerateItemVariants(ctx);
  // After the variants: generated items (Breastplate of Acid Resistance) share text too.
  index.resolveItemEntries();
  index.rebuildSources();

  index.setMeta(META.version, source.version);
  index.setMeta(META.origin, source.label);
  index.setMeta(META.installedAt, new Date().toISOString());
  index.deleteMeta(META.inProgress);
  report({ phase: 'done' });

  return {
    version: source.version,
    plan: {
      added: plan.added.length,
      changed: plan.changed.length,
      removed: plan.removed,
      unchanged: plan.unchanged,
    },
    issues,
    skipped,
    copyErrors,
    durationMs: Date.now() - started,
  };
}
