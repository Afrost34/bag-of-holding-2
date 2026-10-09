import { Entries, EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { ChevronLeft, ChevronRight, Crown, Plus, RotateCcw, Swords, X } from 'lucide-react';
import { useState } from 'react';
import type { BoardCard } from '../../app/boards/model';
import {
  advanceTurn,
  changeHp,
  CONDITIONS,
  LAIR,
  previousTurn,
  removeCombatant,
  sortCombatants,
  turnOrder,
  type Combatant,
  type CombatState,
} from '../../app/boards/combat';
import { CharacterCard } from '../../app/characters/CharacterCard';
import { ConditionBadge } from '../../app/conditions/ConditionBadge';
import { useEntity } from '../../app/data/entities';
import { useEncounters } from '../../app/encounters/store';
import { combatFor } from '../../app/encounters/run';
import { useEncounterInfo } from '../../app/encounters/useDifficulty';
import { CombatAdd } from './CombatAdd';
import { useBoardActions } from './context';

type CombatCard = Extract<BoardCard, { kind: 'combat' }>;

/** "Goblin 2", "Lia": what a combatant is called. */
function useCombatantName(c: Combatant): string {
  const entity = useEntity(c.key ?? null);
  const base =
    c.name ??
    (entity.status === 'found' ? entity.entity.name : (c.key?.split(':')[1]?.split('@')[0] ?? '?'));
  return c.n ? `${base} ${String(c.n)}` : base;
}

/** The combat tracker: turn order, hit points, conditions, concentration, legendary actions. */
export function CombatBody({ card }: { card: CombatCard }) {
  const { update } = useBoardActions();
  // A new, empty combat opens on what to add.
  const [adding, setAdding] = useState(card.combatants.length === 0);
  // The opened combatant shows beside the order, which stays as it is.
  const [openId, setOpenId] = useState<string | null>(null);
  const change = (fn: (s: CombatState) => CombatState) => {
    update(card.id, (c) => (c.kind === 'combat' ? { ...c, ...fn(c) } : c));
  };
  const order = turnOrder(card.combatants);
  const fighting = new Set(card.combatants.flatMap((c) => (c.character ? [c.character] : [])));
  const byId = new Map(card.combatants.map((c) => [c.id, c]));
  const opened = openId ? byId.get(openId) : undefined;
  const open = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    // Room for the panel beside the order.
    update(card.id, (c) => (c.w < 900 ? { ...c, w: 900 } : c));
  };
  return (
    <div className={cn('h-full', opened && 'grid grid-cols-[minmax(0,27rem)_minmax(0,1fr)] gap-3')}>
      <div className="min-h-0 space-y-2 overflow-auto">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-semibold text-muted uppercase">
            {card.turn === null ? 'Not started' : `Round ${String(card.round)}`}
          </span>
          <span className="flex-1" />
          <Button
            variant="ghost"
            aria-label="Reset combat"
            title="Reset: everyone out, back to round 1"
            disabled={card.combatants.length === 0}
            onClick={() => {
              if (!window.confirm('Remove everyone from this combat and start again?')) return;
              change(() => ({ combatants: [], turn: null, round: 1 }));
              setOpenId(null);
              setAdding(true);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            aria-label="Previous turn"
            disabled={card.turn === null}
            onClick={() => {
              change(previousTurn);
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="primary"
            disabled={order.length === 0}
            onClick={() => {
              change(advanceTurn);
            }}
          >
            {card.turn === null ? 'Start' : 'Next turn'}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <ol aria-label="Combat order" className="divide-y divide-border">
          {order.map((id) => {
            const c = byId.get(id);
            return !c ? (
              <li
                key={LAIR}
                aria-current={card.turn === LAIR ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-2 px-1 py-1.5 text-sm italic',
                  card.turn === LAIR && 'bg-accent-soft font-semibold',
                )}
              >
                <span className="w-12 text-center text-muted">20</span>
                <Crown className="h-4 w-4 text-muted" aria-hidden /> Lair actions
              </li>
            ) : (
              <Row
                key={id}
                c={c}
                current={card.turn === id}
                opened={openId === id}
                onOpen={() => {
                  open(id);
                }}
                onChange={(next) => {
                  change((s) => ({
                    ...s,
                    combatants: s.combatants.map((x) => (x.id === id ? next(x) : x)),
                  }));
                }}
                onSorted={() => {
                  change((s) => ({ ...s, combatants: sortCombatants(s.combatants) }));
                }}
                onRemove={() => {
                  change((s) => removeCombatant(s, id));
                }}
              />
            );
          })}
        </ol>
        {adding ? (
          <CombatAdd
            change={change}
            fighting={fighting}
            occupied={card.combatants.length > 0}
            onDone={() => {
              setAdding(false);
            }}
          />
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add to the combat
          </Button>
        )}
      </div>
      {opened && (
        <CombatantPanel
          c={opened}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}

/** The opened combatant: its stat block or character card, and the rules of its conditions. */
function CombatantPanel({ c, onClose }: { c: Combatant; onClose: () => void }) {
  const name = useCombatantName(c);
  return (
    <aside
      aria-label={`${name} details`}
      className="min-h-0 overflow-auto rounded-md border border-border bg-bg p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate font-serif text-base font-bold">{name}</h4>
        <button
          type="button"
          aria-label={`Close ${name}`}
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-sunken"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {c.conditions.length > 0 && (
        <ul aria-label="Conditions" className="mb-3 space-y-2">
          {c.conditions.map((cond) => (
            <li key={cond}>
              <ConditionBadge condition={cond} />
              <ConditionRules condition={cond} />
            </li>
          ))}
        </ul>
      )}
      {c.key ? (
        <StatBlock entityKey={c.key} />
      ) : c.character ? (
        <CharacterCard characterId={c.character} show={{ spells: true, features: true }} />
      ) : (
        <p className="text-sm text-muted">Added by hand: no stat block.</p>
      )}
    </aside>
  );
}

/** A condition's rules, as the compendium has them (the 2024 text first). */
function ConditionRules({ condition }: { condition: string }) {
  const name = condition.toLowerCase();
  const now = useEntity(`condition:${name}@xphb`);
  const old = useEntity(now.status === 'missing' ? `condition:${name}@phb` : null);
  const found = now.status === 'found' ? now.entity : old.status === 'found' ? old.entity : null;
  if (!found) return null;
  return (
    <div className="mt-1 text-xs [&_p]:my-0.5">
      <Entries entries={found.data.entries} />
    </div>
  );
}

function Row({
  c,
  current,
  opened,
  onOpen,
  onChange,
  onSorted,
  onRemove,
}: {
  c: Combatant;
  current: boolean;
  opened: boolean;
  onOpen: () => void;
  onChange: (fn: (c: Combatant) => Combatant) => void;
  onSorted: () => void;
  onRemove: () => void;
}) {
  const name = useCombatantName(c);
  const [amount, setAmount] = useState('');
  const down = c.hp <= 0;
  const hit = (sign: 1 | -1) => {
    const n = Math.abs(Number(amount));
    if (!n) return;
    onChange((x) => changeHp(x, sign * n));
    setAmount('');
  };
  return (
    <li
      aria-label={name}
      aria-current={current ? 'true' : undefined}
      className={cn('px-1 py-1.5', current && 'bg-accent-soft', down && 'opacity-60')}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <input
          type="number"
          value={c.initiative}
          aria-label={`${name} initiative`}
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            onChange((x) => ({ ...x, initiative: v }));
          }}
          onBlur={onSorted}
          className="w-12 rounded border border-border bg-surface px-1 text-center"
        />
        <button
          type="button"
          aria-expanded={opened}
          onClick={onOpen}
          className={cn(
            'min-w-0 flex-1 truncate text-left hover:text-accent-ink',
            current && 'font-semibold',
            opened && 'text-accent-ink underline',
            down && 'line-through',
          )}
        >
          {name}
        </button>
        {c.conditions.map((cond) => (
          <button
            key={cond}
            type="button"
            aria-label={`Remove ${cond} from ${name}`}
            title={`${cond} (click to remove)`}
            onClick={() => {
              onChange((x) => ({ ...x, conditions: x.conditions.filter((k) => k !== cond) }));
            }}
          >
            <ConditionBadge condition={cond} compact />
          </button>
        ))}
        <span className="rounded bg-sunken px-1.5 text-xs font-semibold" title="Armor Class">
          AC {c.ac}
        </span>
        <span
          className={cn(
            'min-w-16 text-right text-xs font-semibold tabular-nums',
            down && 'text-str',
          )}
          aria-label={`${name} hit points`}
        >
          {c.hp}/{c.maxHp}
          {c.tempHp ? ` +${String(c.tempHp)}` : ''}
        </span>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="text-muted hover:text-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 pl-[3.375rem] text-xs">
        <input
          type="number"
          min={0}
          value={amount}
          placeholder="HP"
          aria-label={`${name} damage or healing`}
          onChange={(e) => {
            setAmount(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') hit(-1);
          }}
          className="w-14 rounded border border-border bg-surface px-1"
        />
        <button
          type="button"
          aria-label={`Damage ${name}`}
          onClick={() => {
            hit(-1);
          }}
          className="rounded border border-border px-1.5 font-semibold text-str hover:border-str"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Heal ${name}`}
          onClick={() => {
            hit(1);
          }}
          className="rounded border border-border px-1.5 font-semibold text-wis hover:border-wis"
        >
          +
        </button>
        <button
          type="button"
          aria-pressed={c.concentration === true}
          aria-label={`${name} concentrating`}
          title="Concentration"
          onClick={() => {
            onChange((x) => {
              const { concentration: _c, ...rest } = x;
              return x.concentration ? rest : { ...rest, concentration: true };
            });
          }}
          className={cn(
            'rounded border px-1.5 font-bold',
            c.concentration ? 'border-accent bg-accent text-accent-fg' : 'border-border text-muted',
          )}
        >
          C
        </button>
        {c.legendary && (
          <span className="flex items-center gap-0.5" aria-label={`${name} legendary actions`}>
            <Crown className="h-3.5 w-3.5 text-muted" aria-hidden />
            {Array.from({ length: c.legendary.max }, (_, i) => {
              const used = i < (c.legendary?.used ?? 0);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${used ? 'Restore' : 'Use'} a legendary action of ${name}`}
                  onClick={() => {
                    onChange((x) =>
                      x.legendary
                        ? {
                            ...x,
                            legendary: {
                              ...x.legendary,
                              used: used ? x.legendary.used - 1 : x.legendary.used + 1,
                            },
                          }
                        : x,
                    );
                  }}
                  className={cn('h-3 w-3 rounded-full border border-text', !used && 'bg-text')}
                />
              );
            })}
          </span>
        )}
        <select
          value=""
          aria-label={`Add a condition to ${name}`}
          onChange={(e) => {
            const cond = e.target.value;
            if (cond) onChange((x) => ({ ...x, conditions: [...x.conditions, cond] }));
          }}
          className="rounded border border-border bg-surface px-1"
        >
          <option value="">+ Condition</option>
          {CONDITIONS.filter((k) => !c.conditions.includes(k)).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function StatBlock({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status !== 'found') return null;
  const e = state.entity;
  return (
    <div className="text-sm">
      <EntityView type={e.type} data={e.data} edition={e.edition} />
    </div>
  );
}

/** An encounter on a board: its monsters, difficulty, and a button that starts the fight. */
export function EncounterBody({ card }: { card: Extract<BoardCard, { kind: 'encounter' }> }) {
  const { addBeside } = useBoardActions();
  const encounter = useEncounters((s) => s.encounters.find((e) => e.id === card.encounter));
  const info = useEncounterInfo(encounter);
  const [starting, setStarting] = useState(false);
  if (!encounter) return <p className="text-muted">This encounter no longer exists.</p>;
  return (
    <div className="space-y-2">
      <ul className="text-sm">
        {encounter.monsters.map((m) => (
          <MonsterLine key={m.npc ?? m.key} entityKey={m.key} name={m.name} count={m.count} />
        ))}
      </ul>
      {info.difficulty && (
        <p className="text-sm">
          <strong>{info.difficulty.rating}</strong> for {info.party.length} characters
          {info.showXp && ` · ${info.difficulty.xp.toLocaleString('en')} XP`}
        </p>
      )}
      <Button
        variant="primary"
        disabled={starting || encounter.monsters.length === 0}
        onClick={() => {
          setStarting(true);
          void combatFor(encounter)
            .then((state) => {
              addBeside(card.id, [{ kind: 'combat', encounter: encounter.id, ...state }]);
            })
            .finally(() => {
              setStarting(false);
            });
        }}
      >
        <Swords className="h-4 w-4" aria-hidden /> Start combat
      </Button>
    </div>
  );
}

function MonsterLine({
  entityKey,
  name,
  count,
}: {
  entityKey: string;
  /** A campaign NPC's name. */
  name?: string | undefined;
  count: number;
}) {
  const entity = useEntity(entityKey);
  const block = entity.status === 'found' ? entity.entity.name : entityKey;
  return (
    <li>
      {count} × {name ? `${name} (${block})` : block}
    </li>
  );
}
