export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = readonly SqlValue[] | Readonly<Record<string, SqlValue>>;

/**
 * The few synchronous SQLite operations the index needs. Implemented over the official
 * SQLite WebAssembly build (browser worker and Node tests); kept this small so the index never
 * depends on a specific driver.
 */
export interface SqlDatabase {
  exec(sql: string, params?: SqlParams): void;
  /** Rows as objects; `T` is the caller's description of the selected columns. */
  all<T extends object>(sql: string, params?: SqlParams): T[];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed row cast
  get<T extends object>(sql: string, params?: SqlParams): T | undefined;
  /** Runs `fn` in a transaction; rolls back if it throws. */
  transaction<T>(fn: () => T): T;
  close(): void;
}
