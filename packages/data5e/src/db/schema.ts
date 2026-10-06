import type { SqlDatabase } from './types';

/**
 * The index is a cache: it can always be rebuilt from 5etools files and homebrew packs.
 * Bump SCHEMA_VERSION on any change; an older database is then dropped and rebuilt.
 */
export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One row per indexed file: a 5etools data file or a homebrew pack.
CREATE TABLE IF NOT EXISTS files (
  path       TEXT PRIMARY KEY,
  sha        TEXT NOT NULL,
  layer      TEXT NOT NULL,          -- '5etools' | 'homebrew'
  entities   INTEGER NOT NULL,
  indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  key      TEXT PRIMARY KEY,         -- type:identity@source, lowercase
  type     TEXT NOT NULL,            -- 5etools array name, e.g. spell, classFeature
  name     TEXT NOT NULL,
  source   TEXT NOT NULL,
  page     INTEGER,
  edition  TEXT NOT NULL,            -- '2014' | '2024'
  layer    TEXT NOT NULL,
  file     TEXT NOT NULL,
  raw      TEXT NOT NULL,            -- JSON as published
  resolved TEXT,                     -- JSON after _copy resolution; NULL when not a copy
  is_copy  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS entities_type_name ON entities(type, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS entities_source ON entities(source COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS entities_file ON entities(file);
CREATE INDEX IF NOT EXISTS entities_copy ON entities(is_copy) WHERE is_copy = 1;

-- File-level data that is not an entity list (_meta, loot tables, lookups, source registry).
CREATE TABLE IF NOT EXISTS aux (
  file TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (file, name)
);

CREATE TABLE IF NOT EXISTS sources (
  id        TEXT PRIMARY KEY COLLATE NOCASE,
  name      TEXT NOT NULL,
  kind      TEXT NOT NULL,
  grp       TEXT NOT NULL,
  published TEXT,
  edition   TEXT,
  playtest  INTEGER NOT NULL,
  entities  INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE IF NOT EXISTS entity_search USING fts5(
  name,
  content = 'entities',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entity_search(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  INSERT INTO entity_search(entity_search, rowid, name) VALUES ('delete', old.rowid, old.name);
END;
CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE OF name ON entities BEGIN
  INSERT INTO entity_search(entity_search, rowid, name) VALUES ('delete', old.rowid, old.name);
  INSERT INTO entity_search(rowid, name) VALUES (new.rowid, new.name);
END;
`;

const TABLES = ['entity_search', 'entities', 'files', 'aux', 'sources', 'meta'];

/** Creates the schema, or drops and recreates it when the stored version differs. */
export function migrate(db: SqlDatabase): void {
  let version: number | undefined;
  try {
    const row = db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'");
    version = row ? Number(row.value) : undefined;
  } catch {
    version = undefined; // fresh database
  }
  if (version !== undefined && version !== SCHEMA_VERSION) {
    for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  db.exec(SCHEMA);
  db.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', ?)", [
    String(SCHEMA_VERSION),
  ]);
}
