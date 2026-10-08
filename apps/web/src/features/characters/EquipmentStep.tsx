import type { EntityDetail, EntitySummary } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import type { AnsweredChoice, CharacterDecisions, InventoryItem } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { ChevronDown, PackagePlus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  addCoins,
  carrying,
  packItems,
  coinsFromCopper,
  NO_COINS,
  type CharacterFile,
  type Coins,
} from '../../app/characters/model';
import { dataWorker } from '../../app/data/client';
import { loadEntity } from '../../app/data/entities';
import type { CharacterView } from '../../app/data/protocol';
import { ChoiceControl } from './ChoiceControl';
import { pickName } from './steps';
import { useTableRules } from './tableRules';
import { Accordion, StepTitle } from './ui';

const COIN_KEYS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
const TYPE_NAMES: Record<string, string> = {
  LA: 'Light Armor', MA: 'Medium Armor', HA: 'Heavy Armor', S: 'Shield', M: 'Melee Weapon',
  R: 'Ranged Weapon', A: 'Ammunition', G: 'Adventuring Gear', AT: "Artisan's Tools", T: 'Tools',
  INS: 'Instrument', GS: 'Gaming Set', SCF: 'Spellcasting Focus', P: 'Potion', RG: 'Ring',
  WD: 'Wand', RD: 'Rod', SC: 'Scroll', TG: 'Trade Good', FD: 'Food and Drink', MNT: 'Mount',
  TAH: 'Tack and Harness', VEH: 'Vehicle', $: 'Treasure',
}; // prettier-ignore

const DONE = { Wear: 'Worn', Wield: 'Wielded', Equip: 'Equipped' } as const;

const code = (v: unknown) => (typeof v === 'string' ? (v.split('|')[0] ?? '') : '');

/** What an item is, in a few words: "Heavy Armor", "Wondrous item, uncommon". */
function itemLine(e: EntityDetail): string {
  const type =
    TYPE_NAMES[code(e.data.type)] ?? (e.data.wondrous === true ? 'Wondrous Item' : 'Gear');
  const rarity =
    typeof e.data.rarity === 'string' && e.data.rarity !== 'none' ? `, ${e.data.rarity}` : '';
  return `${type}${rarity}`;
}

/** Choose Equipment, as on D&D Beyond: the starting equipment, then the inventory row by row. */
export function EquipmentStep({
  character,
  view,
  choices,
  isEnabled,
  disabledSources,
  save,
  setPicks,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  choices: AnsweredChoice[];
  isEnabled: (source: string | undefined) => boolean;
  disabledSources: readonly string[];
  save: (c: CharacterFile) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
}) {
  const decisions: CharacterDecisions = character.decisions;
  const inventory = decisions.inventory ?? [];
  const entities = useItemEntities(inventory);
  // Pact of the Blade or Hex Warrior: a weapon can be bound to the character.
  const pactFeature =
    ['Pact of the Blade', 'Hex Warrior'].find((f) =>
      (view?.features ?? []).some((x) => x.name.toLowerCase() === f.toLowerCase()),
    ) ?? null;
  const setInventory = (next: InventoryItem[]) => {
    save({ ...character, decisions: { ...decisions, inventory: next } });
  };
  const change = (i: number, patch: Partial<InventoryItem>) => {
    setInventory(inventory.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  };
  const starting = (view?.grants ?? []).filter(
    (g) => g.kind === 'item' || g.kind === 'money' || g.kind === 'special',
  );
  const addStarting = async () => {
    const items: InventoryItem[] = [...inventory];
    let coins: Coins = character.coins;
    for (const g of starting) {
      if (g.kind === 'item') items.push(...(await unpacked(g.key, g.quantity)));
      else if (g.kind === 'special') items.push({ key: '', name: g.text, quantity: g.quantity });
      else coins = addCoins(coins, coinsFromCopper(g.cp));
    }
    save({ ...character, coins, decisions: { ...decisions, inventory: items } });
  };
  const weight = inventory.reduce((n, it) => {
    const w = entities.get(it.key)?.data.weight;
    return n + (typeof w === 'number' ? w * it.quantity : 0);
  }, 0);
  // Carrying rules: the campaign's (or the character's own outside campaigns).
  const table = useTableRules(character);
  const load = carrying(view?.sheet.abilities.str.score.value ?? 10, weight, table.encumbrance);

  return (
    <div className="space-y-4">
      <StepTitle>Choose Equipment</StepTitle>
      <Accordion
        title="Starting Equipment"
        subtitle={
          choices.length
            ? `${String(choices.length)} Choice${choices.length === 1 ? '' : 's'}`
            : undefined
        }
        pending={choices.some((c) => c.picks.length < c.count)}
        defaultOpen={inventory.length === 0}
      >
        <div className="space-y-3">
          {choices.map((c) => (
            <ChoiceControl
              key={c.id}
              choice={c}
              decisions={decisions}
              isEnabled={isEnabled}
              onChange={(picks) => {
                setPicks(c.id, picks);
              }}
            />
          ))}
          {starting.length > 0 ? (
            <Button variant="primary" onClick={() => void addStarting()}>
              <PackagePlus className="h-4 w-4" aria-hidden /> Add starting equipment
            </Button>
          ) : (
            <p className="text-sm text-muted">
              Pick a class and a background to get their equipment.
            </p>
          )}
        </div>
      </Accordion>

      <section aria-label="Inventory" className="space-y-2">
        <div className="flex items-center rounded-md border-l-4 border-accent bg-sunken px-3 py-2">
          <h3 className="flex-1 font-bold">Current Inventory ({inventory.length})</h3>
          <span className="text-sm">Total Weight: {Math.round(weight * 10) / 10} lb</span>
        </div>
        {load && (
          <p
            role="status"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              load.state === 'fine'
                ? 'bg-sunken text-muted'
                : 'bg-accent-soft font-semibold text-accent-ink',
            )}
          >
            {load.state === 'fine'
              ? `Carrying ${String(Math.round(weight))} of ${String(load.capacity)} lb.`
              : load.state === 'over capacity'
                ? `Over capacity: ${String(Math.round(weight))} of ${String(load.capacity)} lb. Speed 5 ft.`
                : `${load.state === 'encumbered' ? 'Encumbered' : 'Heavily encumbered'}: speed −${String(load.speedPenalty)} ft${load.state === 'heavily encumbered' ? ', disadvantage on Strength, Dexterity and Constitution checks, attacks and saves' : ''}.`}
          </p>
        )}
        {inventory.map((it, i) => (
          <InventoryRow
            pactFeature={pactFeature}
            key={`${it.key}${it.name ?? ''}-${String(i)}`}
            item={it}
            entity={entities.get(it.key)}
            onChange={(patch) => {
              change(i, patch);
            }}
            onRemove={() => {
              setInventory(inventory.filter((_, j) => j !== i));
            }}
          />
        ))}
        <AddItem
          disabledSources={disabledSources}
          onAdd={(key) => {
            void unpacked(key, 1).then((items) => {
              setInventory([...inventory, ...items]);
            });
          }}
        />
      </section>

      <fieldset className="flex flex-wrap gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-bold">Currency</legend>
        {COIN_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <span className="w-6 font-bold uppercase">{k}</span>
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
    </div>
  );
}

/** The items' entities, for names, weights and whether they can be worn. */
function useItemEntities(inventory: readonly InventoryItem[]): Map<string, EntityDetail> {
  const [map, setMap] = useState(new Map<string, EntityDetail>());
  const keys = [...new Set(inventory.map((i) => i.key).filter(Boolean))].sort().join('\n');
  useEffect(() => {
    let cancelled = false;
    const list = keys ? keys.split('\n') : [];
    void Promise.all(
      list.map(
        async (k) =>
          [
            k,
            (await loadEntity(k)) ?? (await loadEntity(k.replace(/^item:/, 'baseitem:'))),
          ] as const,
      ),
    ).then((pairs) => {
      if (!cancelled)
        setMap(
          new Map(pairs.filter((p): p is readonly [string, EntityDetail] => p[1] !== undefined)),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [keys]);
  return map;
}

function InventoryRow({
  item,
  entity,
  pactFeature,
  onChange,
  onRemove,
}: {
  item: InventoryItem;
  /** The feature that binds a weapon (Pact of the Blade, Hex Warrior), if the character has one. */
  pactFeature: string | null;
  entity: EntityDetail | undefined;
  onChange: (patch: Partial<InventoryItem>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const name = item.name ?? entity?.name ?? pickName(item.key);
  const type = code(entity?.data.type);
  const attunes = entity?.data.reqAttune !== undefined && entity.data.reqAttune !== false;
  const wearable = entity !== undefined && !['$', 'G', 'TG', 'FD', 'A'].includes(type);
  const wearLabel = ['LA', 'MA', 'HA', 'S'].includes(type)
    ? 'Wear'
    : ['M', 'R'].includes(type)
      ? 'Wield'
      : 'Equip';
  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {name}
              {entity && Array.isArray(entity.data.reprintedAs) && (
                <span className="ml-1.5 rounded bg-sunken px-1 text-xs font-normal text-muted">
                  Legacy
                </span>
              )}
            </span>
            <span className="block text-xs text-muted">{entity ? itemLine(entity) : 'Other'}</span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-faint transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        {wearable && (
          <button
            type="button"
            aria-pressed={item.equipped === true}
            aria-label={`${wearLabel} ${name}`}
            onClick={() => {
              onChange({ equipped: item.equipped !== true });
            }}
            className={cn(
              'rounded border px-2 py-0.5 text-xs font-bold uppercase',
              item.equipped
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-accent text-accent-ink',
            )}
          >
            {item.equipped ? DONE[wearLabel] : wearLabel}
          </button>
        )}
        {pactFeature && ['M', 'R'].includes(type) && (
          <button
            type="button"
            aria-pressed={item.pact === true}
            aria-label={'Pact weapon: ' + name}
            title={
              pactFeature +
              ': attacks with Charisma when it is better, and you are proficient with it'
            }
            onClick={() => {
              onChange({ pact: item.pact !== true });
            }}
            className={cn(
              'rounded border px-2 py-0.5 text-xs font-bold uppercase',
              item.pact ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted',
            )}
          >
            {item.pact ? 'Pact weapon' : 'Make pact weapon'}
          </button>
        )}
        {attunes && (
          <button
            type="button"
            aria-pressed={item.attuned === true}
            aria-label={`Attune to ${name}`}
            onClick={() => {
              onChange({ attuned: item.attuned !== true });
            }}
            className={cn(
              'rounded border px-2 py-0.5 text-xs font-bold uppercase',
              item.attuned ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted',
            )}
          >
            {item.attuned ? 'Attuned' : 'Attune'}
          </button>
        )}
        <label className="flex items-center gap-1 text-xs font-bold">
          QTY
          <input
            type="number"
            min={1}
            value={item.quantity}
            aria-label={`Quantity of ${name}`}
            onChange={(e) => {
              onChange({ quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) });
            }}
            className="w-12 rounded border border-border bg-surface px-1 py-0.5 text-sm font-normal"
          />
        </label>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-3 text-sm">
          {entity ? (
            <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
          ) : (
            <p className="text-muted">Not in the compendium.</p>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-sm text-accent-ink hover:underline"
          >
            <X className="h-4 w-4" aria-hidden /> Remove item
          </button>
        </div>
      )}
    </div>
  );
}

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

/** An item as inventory lines: a pack becomes what is in it (an Entertainer's Pack → its items). */
async function unpacked(key: string, quantity: number): Promise<InventoryItem[]> {
  const entity = (await loadEntity(key)) ?? (await loadEntity(key.replace(/^item:/, 'baseitem:')));
  return (entity && packItems(entity.data, quantity)) ?? [{ key, quantity }];
}
