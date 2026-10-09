import { Button, cn } from '@boh/ui';
import { useContext, useEffect, useState } from 'react';
import {
  addCombatant,
  joinCombat,
  type CharacterInput,
  type Combatant,
  type CombatState,
  type MonsterInput,
} from '../../app/boards/combat';
import { useCharacters } from '../../app/characters/store';
import { useEncounters } from '../../app/encounters/store';
import { characterInputs, monsterInputs } from '../../app/encounters/run';
import { JournalViewContext } from '../../app/journal/notes/context';
import { EntitySearch } from '../../app/search/EntitySearch';

const TABS = ['Creature', 'Character', 'Encounter', 'By hand'] as const;
type Tab = (typeof TABS)[number];

/**
 * Adding to a combat on the board: a creature from the compendium (several at once), the
 * campaign's characters, a prepared encounter (its creatures and the party), or anyone by hand.
 * Newcomers roll initiative and take their place in the order, even mid-fight.
 */
export function CombatAdd({
  change,
  fighting,
  onDone,
}: {
  change: (fn: (s: CombatState) => CombatState) => void;
  /** Ids of the characters already in the fight. */
  fighting: ReadonlySet<string>;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Creature');
  const [busy, setBusy] = useState(false);
  const join = (monsters: Promise<MonsterInput[]>, characters: Promise<CharacterInput[]>) => {
    setBusy(true);
    void Promise.all([monsters, characters])
      .then(([m, c]) => {
        change((s) => joinCombat(s, m, c));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return (
    <section
      aria-label="Add to the combat"
      className="space-y-2 rounded-md border border-border p-2"
    >
      <div role="tablist" aria-label="Add" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
            }}
            className={cn(
              'rounded px-2 py-1 text-xs font-semibold',
              tab === t ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-sunken',
            )}
          >
            {t}
          </button>
        ))}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
      {tab === 'Creature' && (
        <CreaturePick
          busy={busy}
          onAdd={(key, count) => {
            join(monsterInputs([{ key, count }]), Promise.resolve([]));
          }}
        />
      )}
      {tab === 'Character' && (
        <CharacterPick
          fighting={fighting}
          busy={busy}
          onAdd={(list) => {
            join(Promise.resolve([]), characterInputs(list));
          }}
        />
      )}
      {tab === 'Encounter' && (
        <EncounterPick
          busy={busy}
          onLoad={(encounter, party) => {
            join(monsterInputs(encounter.monsters), characterInputs(party));
          }}
        />
      )}
      {tab === 'By hand' && (
        <ByHand
          onAdd={(c) => {
            change((s) => addCombatant(s, c));
          }}
        />
      )}
    </section>
  );
}

/** The board's campaign, if it has one. */
const useCampaignId = () => useContext(JournalViewContext)?.campaignId;

function CreaturePick({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (key: string, count: number) => void;
}) {
  const [count, setCount] = useState(1);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        How many
        <input
          type="number"
          min={1}
          max={30}
          value={count}
          onChange={(e) => {
            setCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)));
          }}
          className="w-16 rounded border border-border bg-surface px-2 py-1"
        />
      </label>
      <EntitySearch
        types={['monster']}
        label="Add a creature"
        placeholder={busy ? 'Adding…' : 'Find a creature: goblin, owlbear…'}
        onAdd={(key) => {
          onAdd(key, count);
        }}
      />
    </div>
  );
}

function CharacterPick({
  fighting,
  busy,
  onAdd,
}: {
  fighting: ReadonlySet<string>;
  busy: boolean;
  onAdd: (list: ReturnType<typeof useCharacters.getState>['characters']) => void;
}) {
  const campaignId = useCampaignId();
  const { characters, loaded, load } = useCharacters();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const party = characters.filter((c) => (c.campaign ?? undefined) === campaignId);
  const free = party.filter((c) => !fighting.has(c.id));
  if (!loaded) return <p className="text-sm text-muted">Loading characters…</p>;
  if (party.length === 0)
    return (
      <p className="text-sm text-muted">
        {campaignId ? 'This campaign has no characters yet.' : 'No characters in the library.'}
      </p>
    );
  return (
    <div className="space-y-1">
      <ul aria-label="Characters" className="space-y-1">
        {party.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{c.name}</span>
            {fighting.has(c.id) ? (
              <span className="text-xs text-muted">In the fight</span>
            ) : (
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Add ${c.name}`}
                onClick={() => {
                  onAdd([c]);
                }}
              >
                Add
              </Button>
            )}
          </li>
        ))}
      </ul>
      {free.length > 1 && (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            onAdd(free);
          }}
        >
          Add the whole party
        </Button>
      )}
    </div>
  );
}

function EncounterPick({
  busy,
  onLoad,
}: {
  busy: boolean;
  onLoad: (
    encounter: ReturnType<typeof useEncounters.getState>['encounters'][number],
    party: ReturnType<typeof useCharacters.getState>['characters'],
  ) => void;
}) {
  const campaignId = useCampaignId();
  const { encounters, loaded, load } = useEncounters();
  const characters = useCharacters();
  useEffect(() => {
    if (!loaded) void load();
    if (!characters.loaded) void characters.load();
  }, [loaded, load, characters]);
  const mine = encounters.filter((e) => (e.campaign ?? undefined) === campaignId);
  const [picked, setPicked] = useState('');
  const [withParty, setWithParty] = useState(true);
  const encounter = mine.find((e) => e.id === picked);
  if (!loaded) return <p className="text-sm text-muted">Loading encounters…</p>;
  if (mine.length === 0)
    return <p className="text-sm text-muted">No encounters prepared here yet.</p>;
  return (
    <form
      aria-label="Load an encounter"
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!encounter) return;
        const party = withParty
          ? characters.characters.filter((c) => (c.campaign ?? undefined) === campaignId)
          : [];
        onLoad(encounter, party);
      }}
    >
      <select
        aria-label="Encounter"
        value={picked}
        onChange={(e) => {
          setPicked(e.target.value);
        }}
        className="w-full rounded border border-border bg-surface px-2 py-1 text-sm"
      >
        <option value="">- Choose an encounter -</option>
        {mine.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      {encounter && (
        <p className="text-xs text-muted">
          {encounter.monsters
            .map((m) => `${String(m.count)} × ${m.name ?? nameOf(m.key)}`)
            .join(', ')}
        </p>
      )}
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={withParty}
          onChange={(e) => {
            setWithParty(e.target.checked);
          }}
        />
        With the party (characters already fighting stay as they are)
      </label>
      <Button type="submit" variant="primary" disabled={busy || !encounter}>
        Load encounter
      </Button>
    </form>
  );
}

/** `monster:goblin@xphb` → `goblin`, until the stat block is read. */
const nameOf = (key: string) => key.slice(key.indexOf(':') + 1, key.lastIndexOf('@'));

function ByHand({ onAdd }: { onAdd: (c: Omit<Combatant, 'id' | 'conditions'>) => void }) {
  const [name, setName] = useState('');
  const [init, setInit] = useState('');
  const [hp, setHp] = useState('');
  const [ac, setAc] = useState('');
  const field = 'rounded border border-border bg-surface px-2 py-1 text-sm';
  return (
    <form
      aria-label="New combatant"
      className="grid grid-cols-[1fr_4rem_4rem_4rem] gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const h = Math.max(1, Number(hp) || 1);
        onAdd({
          name: name.trim(),
          initiative: Number(init) || 0,
          initBonus: 0,
          hp: h,
          maxHp: h,
          ac: Number(ac) || 10,
        });
        setName('');
        setInit('');
        setHp('');
        setAc('');
      }}
    >
      <input
        value={name}
        placeholder="Name"
        aria-label="Combatant name"
        onChange={(e) => {
          setName(e.target.value);
        }}
        className={field}
      />
      <input
        type="number"
        value={init}
        placeholder="Init"
        aria-label="Combatant initiative"
        onChange={(e) => {
          setInit(e.target.value);
        }}
        className={field}
      />
      <input
        type="number"
        value={hp}
        placeholder="HP"
        aria-label="Combatant hit points"
        onChange={(e) => {
          setHp(e.target.value);
        }}
        className={field}
      />
      <input
        type="number"
        value={ac}
        placeholder="AC"
        aria-label="Combatant armor class"
        onChange={(e) => {
          setAc(e.target.value);
        }}
        className={field}
      />
      <Button type="submit" variant="primary" className="col-span-4 justify-self-start">
        Add
      </Button>
    </form>
  );
}
