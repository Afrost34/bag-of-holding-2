import { dataWorker } from '../data/client';
import { loadRows } from '../data/lists';
import { lootTables, type LootTable, type MagicRow, type TreasureTables } from './treasure';

/** The Dungeon Master's Guide treasure tables, read once from the 5etools index. */
export interface TreasureData {
  individual: LootTable[];
  hoard: LootTable[];
  /** Magic items of a rarity, for 2014 or 2024 tables. */
  tables: (edition: '2014' | '2024') => TreasureTables;
}

let loading: Promise<TreasureData> | null = null;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadTreasure(): Promise<TreasureData> {
  loading ??= (async (): Promise<TreasureData> => {
    const worker = dataWorker();
    const [individual, hoard, gems, art, magic, items] = await Promise.all([
      worker.ofType('individual'),
      worker.ofType('hoard'),
      worker.ofType('gems'),
      worker.ofType('artObjects'),
      worker.ofType('magicItems'),
      loadRows('magic-items'),
    ]);
    const valuables = (list: typeof gems) =>
      list.flatMap((e) =>
        typeof e.data.type === 'number' && Array.isArray(e.data.table)
          ? [
              {
                source: e.source.toUpperCase(),
                value: e.data.type,
                table: e.data.table.filter((t): t is string => typeof t === 'string'),
              },
            ]
          : [],
      );
    const gemTables = valuables(gems);
    const artTables = valuables(art);
    const magicTables = magic.flatMap((e) =>
      typeof e.data.type === 'string' && Array.isArray(e.data.table)
        ? [
            {
              source: e.source.toUpperCase(),
              type: e.data.type,
              rows: e.data.table.filter(isObj) as unknown as MagicRow[],
            },
          ]
        : [],
    );
    const usable = items.filter((r) => !r.legacy && !r.generated);
    return {
      individual: lootTables(individual.map((e) => e.data)),
      hoard: lootTables(hoard.map((e) => e.data)),
      tables: (edition) => {
        const book = edition === '2024' ? 'XDMG' : 'DMG';
        return {
          valuables: (kind, value) =>
            (kind === 'gems' ? gemTables : artTables).find(
              (t) => t.source === book && t.value === value,
            )?.table,
          magic: (type) => magicTables.find((t) => t.source === book && t.type === type)?.rows,
          ofRarity: (rarity) =>
            usable.filter((r) => r.f.rarity === rarity && r.edition === edition).map((r) => r.key),
        };
      },
    };
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
