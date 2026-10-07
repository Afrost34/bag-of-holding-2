export {
  type FileStore,
  type FileEntry,
  type EntryKind,
  NotADirectoryError,
  DirectoryNotEmptyError,
  IsADirectoryError,
} from './types';
export { normalizePath, joinPath, dirname, basename, segments, InvalidPathError } from './path';
export { MemoryFileStore } from './memory';
export { OpfsFileStore } from './opfs';
export { syncStore, SYNC_DIR, type SyncOptions, type SyncResult } from './sync/engine';
export { planSync, resolveConflict, type SyncPlan } from './sync/plan';
export {
  blobSha,
  GitHubError,
  GitHubRepo,
  type GitHubRepoOptions,
  type RemoteHead,
  type RemoteRepo,
} from './sync/remote';
