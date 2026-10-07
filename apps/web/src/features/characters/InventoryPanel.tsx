import type { EntitySummary } from '@boh/data5e';
import type { InventoryItem } from '@boh/rules';
import { Button } from '@boh/ui';
import { PackagePlus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import {
  addCoins,
  coinsFromCopper,
  NO_COINS,
  type CharacterFile,
  type Coins,
} from '../../app/characters/model';
import { dataWorker } from '../../app/data/client';
import { entityPath, useEntity } from '../../app/data/entities';
import type { CharacterView } from '../../app/data/protocol';
import { pickName } from './steps';

const COIN_KEYS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;

/** What the character carries: items (equipped, attuned), coins, and adding more. */
export function InventoryPanel({
  character,
  view,
  save,
  disabledSources,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  save: (c: CharacterFile) => void;
  disabledSources: readonly string[];
}) {
  const inventory = character.decisions.inventory ?? [];
  const setInventory = (next: InventoryItem[]) => {
    save({ ...character, decisions: { ...character.decisions, inventory: next } });
  };
  const change = (i: number, patch: Partial<InventoryItem>) => {
    setInventory(inventory.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  };

  // The starting equipment the engine resolved from the picks above.
  const starting = (view?.grants ?? []).filter(
    (g) => g.kind === 'item' || g.kind === 'money' || g.kind === 'special',
  );
  const addStarting = () => {
    const items: InventoryItem[] = [...inventory];
    let coins: Coins = character.coins;
    for (const g of starting) {
      if (g.kind === 'item') items.push({ key: g.key, quantity: g.quantity });
      else if (g.kind === 'special') items.push({ key: '', name: g.text, quantity: g.quantity });
      else coins = addCoins(coins, coinsFromCopper(g.cp));
    }
    save({ ...character, coins, decisions: { ...character.decisions, inventory: items } });
  };

  return (
    <section
      aria-label="Inventory"
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-serif text-lg font-bold">Inventory</h3>
        {starting.length > 0 && inventory.length === 0 && (
          <Button variant="primary" onClick={addStarting}>
            <PackagePlus className="h-4 w-4" aria-hidden /> Add starting equipment
          </Button>
        )}
      </div>
      {inventory.length === 0 ? (
        <p className="text-sm text-muted">Nothing carried yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {inventory.map((it, i) => (
            <InventoryRow
              key={`${it.key}${it.name ?? ''}-${String(i)}`}
              item={it}
              onChange={(patch) => {
                change(i, patch);
              }}
              onRemove={() => {
                setInventory(inventory.filter((_, j) => j !== i));
              }}
            />
          ))}
        </ul>
      )}
      <AddItem
        disabledSources={disabledSources}
        onAdd={(key) => {
          setInventory([...inventory, { key, quantity: 1 }]);
        }}
      />
      <fieldset className="flex flex-wrap gap-3 border-t border-border pt-3">
        <legend className="sr-only">Coins</legend>
        {COIN_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <span className="w-6 font-medium uppercase">{k}</span>
            <input
              type="number"
              min={0}
              value={character.coins[k]}
              aria-label={`${k.toUpperCase()} coins`}
              onChange={(e) => {
                const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                save({ ...character, coins: { ...NO_COINS, ...character.coins, [k]: n } });
              }}
              className="w-20 rounded-md border border-border bg-surface px-2 py-1"
            />
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function InventoryRow({
  item,
  onChange,
  onRemove,
}: {
  item: InventoryItem;
  onChange: (patch: Partial<InventoryItem>) => void;
  onRemove: () => void;
}) {
  const state = useEntity(item.key || null);
  const entity = state.status === 'found' ? state.entity : undefined;
  const name = item.name ?? entity?.name ?? pickName(item.key);
  const attunes = entity?.data.reqAttune !== undefined && entity.data.reqAttune !== false;
  // Gear that does something when worn or held: not coins, trade goods, food or adventuring gear.
  const type = typeof entity?.data.type === 'string' ? (entity.data.type.split('|')[0] ?? '') : '';
  const wearable = entity !== undefined && !['$', 'G', 'TG', 'FD'].includes(type);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      {item.key ? (
        <AppLink to={entityPath(item.key)} className="min-w-0 flex-1 font-medium hover:text-accent">
          {name}
        </AppLink>
      ) : (
        <span className="min-w-0 flex-1 font-medium">{name}</span>
      )}
      <input
        type="number"
        min={1}
        value={item.quantity}
        aria-label={`Quantity of ${name}`}
        onChange={(e) => {
          onChange({ quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) });
        }}
        className="w-14 rounded-md border border-border bg-surface px-2 py-1"
      />
      {item.key && (wearable || attunes) && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={item.equipped === true}
            onChange={(e) => {
              onChange({ equipped: e.target.checked });
            }}
          />
          Equipped
        </label>
      )}
      {attunes && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={item.attuned === true}
            onChange={(e) => {
              onChange({ attuned: e.target.checked });
            }}
          />
          Attuned
        </label>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="rounded p-1 text-muted hover:bg-sunken"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

/** Searches items in the compendium and adds one. */
function AddItem({
  onAdd,
  disabledSources,
}: {
  onAdd: (key: string) => void;
  disabledSources: readonly string[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySummary[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void dataWorker()
        .search(q, { types: ['item', 'baseitem'], excludeSources: disabledSources, limit: 12 })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, disabledSources]);
  const shown = query.trim().length < 2 ? [] : results;
  return (
    <div>
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder="Add an item"
          aria-label="Add an item"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-base focus:border-accent focus:outline-none sm:text-sm"
        />
      </label>
      {shown.length > 0 && (
        <ul aria-label="Items found" className="mt-1 rounded-md border border-border">
          {shown.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r.key);
                  setQuery('');
                }}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunken"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-muted">{r.source}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
