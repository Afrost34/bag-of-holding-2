import { MemoryFileStore, OpfsFileStore, type FileStore } from '@boh/storage';

export type Platform = 'desktop' | 'web';

/** True inside the Tauri desktop shell. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function currentPlatform(): Platform {
  return isDesktop() ? 'desktop' : 'web';
}

/**
 * Opens the store that holds the user's data repo on this device.
 * Desktop: a real folder chosen in settings (wired in M4). Web: the browser's private file system.
 * Falls back to memory where neither is available (e.g. very old browsers), so the app still runs.
 */
export async function openUserStore(desktopRoot?: string): Promise<FileStore> {
  if (isDesktop() && desktopRoot !== undefined) {
    const { TauriFileStore } = await import('@boh/storage/tauri');
    return new TauriFileStore(desktopRoot);
  }
  if (OpfsFileStore.isSupported()) return OpfsFileStore.open('user-data');
  return new MemoryFileStore();
}
