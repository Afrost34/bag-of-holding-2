import { userStore } from '../userStore';
import { journalRoot } from './store';

/**
 * Journal attachments (images, PDFs) as object URLs for `<img>` and links. Read once per file and
 * kept for the session; a campaign has few enough of them for that to be cheap.
 */

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

const extension = (path: string) => path.slice(path.lastIndexOf('.') + 1).toLowerCase();

export function isImage(path: string): boolean {
  return (TYPES[extension(path)] ?? '').startsWith('image/');
}

const urls = new Map<string, Promise<string | null>>();

export function attachmentUrl(campaignId: string, path: string): Promise<string | null> {
  const key = `${campaignId}\n${path}`;
  let url = urls.get(key);
  if (!url) {
    url = userStore()
      .then((store) => store.readFile(`${journalRoot(campaignId)}/${path}`))
      .then((bytes) =>
        bytes
          ? URL.createObjectURL(
              new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type: TYPES[extension(path)] ?? 'application/octet-stream',
              }),
            )
          : null,
      )
      .catch(() => null);
    urls.set(key, url);
  }
  return url;
}

/** Forgets a file's URL after it was moved, replaced or deleted. */
export function forgetAttachment(campaignId: string, path: string): void {
  const key = `${campaignId}\n${path}`;
  void urls.get(key)?.then((u) => {
    if (u) URL.revokeObjectURL(u);
  });
  urls.delete(key);
}

/** Forgets every file's URL (after a sync changed files). */
export function forgetAllAttachments(): void {
  for (const url of urls.values()) {
    void url.then((u) => {
      if (u) URL.revokeObjectURL(u);
    });
  }
  urls.clear();
}
