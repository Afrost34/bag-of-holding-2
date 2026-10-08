import { expect, type Page } from '@playwright/test';

/**
 * Waits until a file in the user's store folder `dir` (e.g. `maps`, `characters`) contains
 * `text`. Saves start at once but take a moment; a reload right after a change can beat them.
 */
export async function waitForSaved(page: Page, dir: string, text: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ dir: folder, text: wanted }) => {
          let handle = await (
            await navigator.storage.getDirectory()
          ).getDirectoryHandle('user-data');
          for (const part of folder.split('/')) handle = await handle.getDirectoryHandle(part);
          for await (const entry of handle.values())
            if (
              entry.kind === 'file' &&
              (await entry.getFile().then((f) => f.text())).includes(wanted)
            )
              return true;
          return false;
        },
        { dir, text },
      ),
    )
    .toBe(true);
}
