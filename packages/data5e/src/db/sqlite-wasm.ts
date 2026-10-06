import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { SqlDatabase, SqlParams } from './types';

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type OoDb = InstanceType<Sqlite3['oo1']['DB']>;

let modulePromise: Promise<Sqlite3> | undefined;

function loadSqlite(): Promise<Sqlite3> {
  modulePromise ??= sqlite3InitModule();
  return modulePromise;
}

class WasmDatabase implements SqlDatabase {
  constructor(private readonly db: OoDb) {}

  exec(sql: string, params?: SqlParams): void {
    if (params === undefined) this.db.exec(sql);
    else this.db.exec({ sql, bind: params });
  }

  all<T extends object>(sql: string, params?: SqlParams): T[] {
    return this.db.selectObjects(sql, params) as T[];
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed row cast
  get<T extends object>(sql: string, params?: SqlParams): T | undefined {
    return this.db.selectObject(sql, params) as T | undefined;
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(() => fn());
  }

  close(): void {
    this.db.close();
  }
}

/** An in-memory database (tests, or browsers without OPFS: the index then lasts one session). */
export async function openMemoryDatabase(): Promise<SqlDatabase> {
  const sqlite3 = await loadSqlite();
  return new WasmDatabase(new sqlite3.oo1.DB(':memory:', 'c'));
}

/**
 * A persistent database in the Origin Private File System, using the "SAH pool" VFS: it needs
 * no cross-origin isolation headers (GitHub Pages can't send them). Worker-only.
 */
export async function openOpfsDatabase(fileName: string): Promise<SqlDatabase> {
  const sqlite3 = await loadSqlite();
  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'boh-sahpool', initialCapacity: 4 });
  const db = new pool.OpfsSAHPoolDb(`/${fileName}`);
  db.exec('PRAGMA synchronous = NORMAL; PRAGMA cache_size = -16000;');
  return new WasmDatabase(db);
}
