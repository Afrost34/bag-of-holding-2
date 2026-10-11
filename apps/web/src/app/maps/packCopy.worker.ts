/**
 * Copies a file into the app's own storage from a worker, writing in place. The main thread's
 * writable stream keeps a second copy (a swap file) until it is closed, so a 2.5 GB pack needed 5 GB
 * of room; a synchronous access handle writes straight into the file and needs 2.5 GB.
 */
export interface CopyRequest {
  file: File;
  /** Folders under the storage root, e.g. `['map-assets', 'packs']`. */
  dir: string[];
  name: string;
}

export type CopyMessage = { copied: number } | { done: true } | { error: string; quota: boolean };

const CHUNK = 8 * 1024 * 1024;

self.onmessage = (e: MessageEvent<CopyRequest>) => {
  void copy(e.data);
};

async function copy({ file, dir, name }: CopyRequest): Promise<void> {
  const reply = (m: CopyMessage) => {
    (self as unknown as { postMessage: (m: CopyMessage) => void }).postMessage(m);
  };
  try {
    let folder = await navigator.storage.getDirectory();
    for (const part of dir) folder = await folder.getDirectoryHandle(part, { create: true });
    const handle = await folder.getFileHandle(name, { create: true });
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      let at = 0;
      while (at < file.size) {
        const bytes = new Uint8Array(await file.slice(at, at + CHUNK).arrayBuffer());
        access.write(bytes, { at });
        at += bytes.byteLength;
        reply({ copied: at });
      }
      access.flush();
    } finally {
      access.close();
    }
    reply({ done: true });
  } catch (error) {
    reply({
      error: error instanceof Error ? error.message : String(error),
      quota: error instanceof DOMException && error.name === 'QuotaExceededError',
    });
  }
}
