import { xpForCr } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  Minus,
  Plus,
  Swords,
  Trash2,
} from 'lucide-react';
import { Entries, EntityView } from '@boh/renderer';
import { CharacterCard } from '../../app/characters/CharacterCard';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath, fluffImages, useEntity, useFluff } from '../../app/data/entities';
import { addMonsters, addNpc, lineId, setCount, type Encounter } from '../../app/encounters/model';
import { useCampaignNpcs } from '../../app/encounters/npcs';
import { journalPath } from '../../app/journal/paths';
import { putOnBoard, runOnBoard } from '../../app/encounters/run';
import { useEncounter, useEncounters } from '../../app/encounters/store';
import { useEncounterInfo, type EncounterInfo } from '../../app/encounters/useDifficulty';
import { useAppNavigate } from '../../app/navigation';
import { EntitySearch } from '../../app/search/EntitySearch';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { encounterLink } from '../../app/tables/model';
import { LinkedTables } from '../../app/tables/LinkedTables';
import { crNumber } from '../../app/tables/treasure';
import { TreasureRoller } from '../../app/tables/TreasureRoller';

/** One encounter: its monsters, its difficulty for the party, and the way to the fight. */
export function EncounterPage({ id }: { id: string }) {
  const { loaded, load, save, remove } = useEncounters();
  const encounter = useEncounter(id);
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const navigate = useAppNavigate();
  usePageTitle(encounter?.name ?? 'Encounter');
  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);
  const info = useEncounterInfo(encounter);
  const npcs = useCampaignNpcs(encounter?.campaign);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!encounter) return <p className="p-8">This encounter does not exist (any more).</p>;

  /** Changes the encounter as stored now (several quick clicks build on each other). */
  const change = (fn: (e: Encounter) => Encounter) => {
    const current = useEncounters.getState().encounters.find((e) => e.id === id);
    if (current) save(fn(current));
  };
  const go = (place: (e: Encounter) => Promise<{ board: string; card: string }>) => {
    setBusy(true);
    void place(encounter)
      .then(({ board, card }) => {
        navigate(`/boards/${board}?focus=${card}`);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <AppLink
          to="/encounters"
          aria-label="All encounters"
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </AppLink>
        <NameInput
          name={encounter.name}
          onRename={(name) => {
            change((e) => ({ ...e, name }));
          }}
        />
        <Button
          variant="primary"
          disabled={busy || encounter.monsters.length === 0}
          onClick={() => {
            go(runOnBoard);
          }}
        >
          <Swords className="h-4 w-4" aria-hidden /> Run on a board
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            go(putOnBoard);
          }}
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Put on a board</span>
          <span className="sr-only sm:hidden">Put on a board</span>
        </Button>
        <Button
          variant="ghost"
          aria-label="Delete encounter"
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="Delete this encounter?"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm"
        >
          <span className="flex-1">Delete “{encounter.name}”?</span>
          <Button
            variant="primary"
            onClick={() => {
              void remove(encounter.id).then(() => {
                navigate('/encounters');
              });
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmDelete(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
        <section aria-label="Monsters" className="space-y-3">
          <EntitySearch
            label="Add a monster"
            placeholder="Add a monster: goblin, owlbear…"
            types={['monster']}
            onAdd={(key) => {
              change((e) => addMonsters(e, [key]));
            }}
          />
          {npcs.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Add from the journal</span>
              <select
                value=""
                aria-label="Add from the journal"
                onChange={(ev) => {
                  const npc = npcs.find((n) => n.note === ev.target.value);
                  if (npc) change((e) => addNpc(e, npc));
                }}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                <option value="">An NPC, a ship… anything with a stat block</option>
                {npcs.map((n) => (
                  <option key={n.note} value={n.note}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {encounter.monsters.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted">
              No monsters yet: search for some above.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {encounter.monsters.map((m) => (
                <MonsterRow
                  key={lineId(m)}
                  entityKey={m.key}
                  {...(m.npc ? { npc: { note: m.npc, name: m.name ?? m.npc } } : {})}
                  count={m.count}
                  cr={info.crs.get(m.key)}
                  showXp={info.showXp}
                  onCount={(n) => {
                    change((e) => setCount(e, lineId(m), n));
                  }}
                />
              ))}
            </ul>
          )}
          {info.party.some((p) => p.id) && (
            <section aria-label="Party">
              <h2 className="mb-2 font-serif text-lg font-bold">Party</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {info.party.flatMap((p) =>
                  p.id ? [<PartyCard key={p.id} id={p.id} name={p.name} level={p.level} />] : [],
                )}
              </ul>
            </section>
          )}
          <LinkedTables
            link={encounterLink(encounter.id)}
            campaign={encounter.campaign ?? null}
            onCreatures={(keys) => {
              change((e) => addMonsters(e, keys));
            }}
            creaturesLabel="Add to this encounter"
          />
          <section aria-label="Treasure" className="space-y-2">
            <h2 className="font-serif text-lg font-bold">Treasure</h2>
            <TreasureRoller
              key={topCr(encounter, info.crs)}
              cr={topCr(encounter, info.crs)}
              edition={
                campaigns.find((c) => c.id === encounter.campaign)?.edition === '2014'
                  ? '2014'
                  : '2024'
              }
              onKeep={(text) => {
                change((x) => ({ ...x, notes: x.notes ? `${x.notes}\n\n${text}` : text }));
              }}
            />
          </section>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notes</span>
            <textarea
              value={encounter.notes ?? ''}
              rows={4}
              placeholder="Tactics, terrain, treasure…"
              onChange={(e) => {
                const notes = e.target.value;
                change((x) => ({ ...x, notes }));
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
        </section>
        <Difficulty info={info} encounter={encounter} onChange={change} />
      </div>
    </div>
  );
}

/** The highest challenge rating in the fight, as the treasure roller writes it (`1/4`, `5`). */
function topCr(encounter: Encounter, crs: ReadonlyMap<string, unknown>): string {
  let best: unknown = undefined;
  for (const m of encounter.monsters) {
    const cr = crs.get(m.key);
    if (cr !== undefined && (best === undefined || crNumber(cr) > crNumber(best))) best = cr;
  }
  const text = typeof best === 'object' && best !== null && 'cr' in best ? best.cr : best;
  return typeof text === 'string' || typeof text === 'number' ? String(text) : '1';
}

function NameInput({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      value={value}
      aria-label="Encounter name"
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onBlur={() => {
        if (value.trim() && value !== name) onRename(value.trim());
      }}
      className="min-w-0 flex-1 rounded bg-transparent px-1 font-serif text-2xl font-bold focus:bg-sunken focus:outline-none"
    />
  );
}

function MonsterRow({
  entityKey,
  npc,
  count,
  cr,
  showXp,
  onCount,
}: {
  entityKey: string;
  /** A campaign NPC fighting with this stat block. */
  npc?: { note: string; name: string };
  count: number;
  cr: unknown;
  showXp: boolean;
  onCount: (n: number) => void;
}) {
  const entity = useEntity(entityKey);
  const blockName = entity.status === 'found' ? entity.entity.name : entityKey;
  const name = npc?.name ?? blockName;
  const found = entity.status === 'found' ? entity.entity : null;
  const images = fluffImages(useFluff(found?.type ?? '', found?.name ?? '', found?.source ?? ''));
  const [open, setOpen] = useState(false);
  const crText =
    typeof cr === 'string'
      ? cr
      : typeof cr === 'object' && cr !== null && 'cr' in cr
        ? String(cr.cr)
        : '—';
  return (
    <li aria-label={name}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Fold ${name}` : `Show ${name}`}
          onClick={() => {
            setOpen(!open);
          }}
          className="rounded p-0.5 text-muted hover:bg-sunken"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
            aria-hidden
          />
        </button>
        {npc ? (
          <span className="min-w-0 flex-1 truncate">
            <AppLink to={journalPath(npc.note)} className="font-medium hover:underline">
              {name}
            </AppLink>{' '}
            <AppLink to={entityPath(entityKey)} className="text-sm text-muted hover:underline">
              ({blockName})
            </AppLink>
          </span>
        ) : (
          <AppLink
            to={entityPath(entityKey)}
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {name}
          </AppLink>
        )}
        <span className="hidden text-xs text-muted sm:inline">
          CR {crText}
          {showXp && ` · ${xpForCr(cr).toLocaleString('en')} XP`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`One fewer ${name}`}
            onClick={() => {
              onCount(count - 1);
            }}
            className="rounded border border-border p-1 hover:border-accent"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="w-6 text-center font-semibold tabular-nums" aria-label={`${name} count`}>
            {count}
          </span>
          <button
            type="button"
            aria-label={`One more ${name}`}
            onClick={() => {
              onCount(count + 1);
            }}
            className="rounded border border-border p-1 hover:border-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {open && found && (
        <div className="border-t border-border px-4 py-3 text-[15px] leading-relaxed">
          {images.length > 0 && (
            <div className="float-right mb-3 ml-4 w-32 sm:w-44">
              <Entries entries={images.slice(0, 1)} />
            </div>
          )}
          <EntityView type={found.type} data={found.data} edition={found.edition} />
        </div>
      )}
    </li>
  );
}

/** A party member: expands to the character at a glance. */
function PartyCard({ id, name, level }: { id: string; name: string; level: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li aria-label={name}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
      >
        <ChevronRight
          className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        <span className="flex-1 font-medium">{name}</span>
        <span className="text-xs text-muted">Level {level}</span>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          <CharacterCard characterId={id} show={{ spells: true, features: true }} />
        </div>
      )}
    </li>
  );
}

const RATING_COLORS: Record<string, string> = {
  Trivial: 'text-muted',
  Easy: 'text-wis',
  Low: 'text-wis',
  Medium: 'text-int',
  Moderate: 'text-int',
  Hard: 'text-con',
  High: 'text-str',
  Deadly: 'text-str',
};

function Difficulty({
  info,
  encounter,
  onChange,
}: {
  info: EncounterInfo;
  encounter: Encounter;
  onChange: (fn: (e: Encounter) => Encounter) => void;
}) {
  const d = info.difficulty;
  const [levels, setLevels] = useState((encounter.party ?? []).join(', '));
  return (
    <aside
      aria-label="Difficulty"
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="font-serif text-lg font-bold">Difficulty</h2>
      {d ? (
        <>
          <p className={cn('font-serif text-3xl font-bold', RATING_COLORS[d.rating])}>{d.rating}</p>
          {info.showXp ? (
            <>
              <p className="text-sm text-muted">
                {d.rules === '2014'
                  ? `${d.baseXp.toLocaleString('en')} XP × ${String(d.multiplier)} = ${d.xp.toLocaleString('en')} adjusted XP (2014 rules)`
                  : `${d.xp.toLocaleString('en')} XP against the 2024 budget`}
              </p>
              <ul className="space-y-0.5 text-sm">
                {d.bands.map((b) => (
                  <li
                    key={b.label}
                    className={cn('flex justify-between', d.rating === b.label && 'font-bold')}
                  >
                    <span>{b.label}</span>
                    <span className="tabular-nums">{b.xp.toLocaleString('en')}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                {d.xpPerCharacter.toLocaleString('en')} XP for each character.
              </p>
            </>
          ) : (
            <DifficultyMeter difficulty={d} />
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Add the party to see how hard this is.</p>
      )}
      <div>
        <h3 className="mb-1 text-sm font-semibold">
          Party{info.party.length ? ` (${String(info.party.length)})` : ''}
        </h3>
        {!info.partyByHand && info.party.length > 0 && (
          <ul className="mb-2 text-sm">
            {info.party.map((p) => (
              <li key={p.name}>
                {p.name} · level {p.level}
              </li>
            ))}
          </ul>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-muted">
            {info.partyByHand || info.party.length === 0
              ? 'Character levels'
              : 'Or other levels instead'}
          </span>
          <input
            value={levels}
            placeholder="3, 3, 3, 3"
            aria-label="Character levels"
            onChange={(e) => {
              setLevels(e.target.value);
            }}
            onBlur={() => {
              const party = levels
                .split(/[\s,]+/)
                .map(Number)
                .filter((n) => Number.isFinite(n) && n >= 1 && n <= 20);
              onChange((x) => {
                const { party: _p, ...rest } = x;
                return party.length ? { ...rest, party } : rest;
              });
            }}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      </div>
    </aside>
  );
}

/** Where the fight sits among the bands, without numbers (milestone campaigns). */
function DifficultyMeter({
  difficulty: d,
}: {
  difficulty: NonNullable<EncounterInfo['difficulty']>;
}) {
  const top = d.bands.at(-1)?.xp ?? 1;
  const at = Math.min(100, Math.round((d.xp / (top * 1.25)) * 100));
  return (
    <div aria-label={`Difficulty: ${d.rating}`}>
      <div className="relative h-3 overflow-hidden rounded-full bg-sunken">
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${String(at)}%` }} />
        {d.bands.map((b) => (
          <span
            key={b.label}
            className="absolute inset-y-0 w-px bg-border-strong"
            style={{ left: `${String(Math.round((b.xp / (top * 1.25)) * 100))}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        {d.bands.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}
