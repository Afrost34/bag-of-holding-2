/**
 * What a sync has to do, from three views of every file: as it was at the last sync (`base`), as
 * it is on this device (`local`) and as it is in the repo (`remote`). Values are Git blob hashes,
 * so equal content is equal whatever the file's age.
 */

export interface SyncPlan {
  /** Changed (or new) in the repo only: copy to this device. */
  download: string[];
  /** Changed (or new) on this device only: copy to the repo. */
  upload: string[];
  /** Deleted in the repo, unchanged here: delete here. */
  deleteLocal: string[];
  /** Deleted here, unchanged in the repo: delete in the repo. */
  deleteRemote: string[];
  /** Changed on both sides, differently: decided by which edit is newer. */
  conflicts: string[];
}

type Hashes = Readonly<Record<string, string>>;

export function planSync(base: Hashes, local: Hashes, remote: Hashes): SyncPlan {
  const plan: SyncPlan = {
    download: [],
    upload: [],
    deleteLocal: [],
    deleteRemote: [],
    conflicts: [],
  };
  const paths = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const path of [...paths].sort()) {
    const b = base[path];
    const l = local[path];
    const r = remote[path];
    if (l === r) continue; // the same on both sides (or gone from both)
    const localChanged = l !== b;
    const remoteChanged = r !== b;
    if (remoteChanged && !localChanged) {
      if (r === undefined) plan.deleteLocal.push(path);
      else plan.download.push(path);
    } else if (localChanged && !remoteChanged) {
      if (l === undefined) plan.deleteRemote.push(path);
      else plan.upload.push(path);
    } else {
      plan.conflicts.push(path);
    }
  }
  return plan;
}

/** Which side wins a conflict: a deletion never beats an edit; otherwise the newer edit wins. */
export function resolveConflict(
  local: { exists: boolean; time: number | null },
  remote: { exists: boolean; time: number | null },
): 'local' | 'remote' {
  if (!local.exists) return 'remote';
  if (!remote.exists) return 'local';
  return (local.time ?? 0) > (remote.time ?? 0) ? 'local' : 'remote';
}
