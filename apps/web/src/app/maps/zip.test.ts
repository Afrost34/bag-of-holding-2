import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readZipEntry, readZipIndex } from './zip';

const make = () =>
  new Blob([
    zipSync(
      {
        'FA_Assets_Webp/Desert/Palm_1x1.webp': [strToU8('palm picture'), { level: 0 }],
        'FA_Assets_Webp/Desert/Dune_4x3.webp': [strToU8('dune '.repeat(400)), { level: 9 }],
        'Copyright.url': strToU8('[InternetShortcut]'),
      },
      { level: 6 },
    ),
  ]);

describe('a zip read in place', () => {
  it('lists its files and cuts one out, stored or deflated', async () => {
    const blob = make();
    const entries = await readZipIndex(blob);
    expect(entries.map((e) => e.name).sort()).toEqual([
      'Copyright.url',
      'FA_Assets_Webp/Desert/Dune_4x3.webp',
      'FA_Assets_Webp/Desert/Palm_1x1.webp',
    ]);
    const palm = entries.find((e) => e.name.endsWith('Palm_1x1.webp'));
    const dune = entries.find((e) => e.name.endsWith('Dune_4x3.webp'));
    if (!palm || !dune) throw new Error('entries');
    expect(palm.method).toBe(0);
    expect(dune.method).toBe(8);
    expect(new TextDecoder().decode(await readZipEntry(blob, palm))).toBe('palm picture');
    expect(new TextDecoder().decode(await readZipEntry(blob, dune))).toBe('dune '.repeat(400));
  });

  it('says so when it is not a zip', async () => {
    await expect(readZipIndex(new Blob(['not a zip at all, just text']))).rejects.toThrow(
      /not a zip/,
    );
  });
});
