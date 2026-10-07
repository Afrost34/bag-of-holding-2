import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalDataSource } from '../dataSource';
import { EntityIndex } from '../db/entityIndex';
import { openMemoryDatabase } from '../db/sqlite-wasm';
import { installData } from '../installer';
import { listLocalDataFiles, localDataDir, PINNED_5ETOOLS_VERSION } from './localData';

/**
 * The pinned 5etools release installed into an in-memory index, as the app has it. Takes a
 * while: call once per test file, in `beforeAll` with a long timeout.
 */
export async function openLocalIndex(): Promise<EntityIndex> {
  const index = EntityIndex.open(await openMemoryDatabase());
  const paths = [...listLocalDataFiles(), 'js/parser.js'];
  const source = new LocalDataSource(
    paths.map((p) => [p, new Uint8Array(readFileSync(join(localDataDir, p)))]),
    PINNED_5ETOOLS_VERSION,
  );
  await installData(index, source);
  return index;
}
