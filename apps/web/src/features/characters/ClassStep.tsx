import { secureRng } from '@boh/dice';
import { Entries } from '@boh/renderer';
import type { AnsweredChoice, CharacterDecisions, ClassLevels } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { Dices, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { ArtImage } from '../../app/ArtImage';
import type { CharacterFile } from '../../app/characters/model';
import { useEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import { useClassPage } from '../../app/data/pages';
import type { CharacterView } from '../../app/data/protocol';
import { ChoiceControl } from './ChoiceControl';
import { ClassChooser } from './ClassChooser';
import { SpellChoicePanel } from './SpellChoicePanel';
import { featureOf, forget, hitPointLevels } from './steps';
import { Accordion, Clamp } from './ui';

const MAX_LEVEL = 20;
const ORDINAL = (n: number) =>
  `${String(n)}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} level`;

export interface ClassStepProps {
  character: CharacterFile;
  view: CharacterView | null;
  update: (next: CharacterDecisions) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
  isEnabled: (source: string | undefined) => boolean;
}

/** A class's own spell lists: cantrips, prepared or known spells, spellbook, Mystic Arcanum. */
const isClassSpellList = (c: AnsweredChoice, keys: readonly string[]) =>
  c.kind === 'spell' && keys.some((k) => c.id.startsWith(`${k}/`)) && !c.via;

/**
 * The Class step, as on D&D Beyond: character level and hit points at the top, then each class
 * with its level, its features as folding rows holding their choices, and its spells.
 */
export function ClassStep(props: ClassStepProps) {
  const { character, view, update } = props;
  const decisions = character.decisions;
  const classes = decisions.classes;
  const [adding, setAdding] = useState(false);
  const [managingHp, setManagingHp] = useState(false);

  const setClasses = (next: ClassLevels[], forgetKeys: (string | undefined)[] = []) => {
    const cleaned = forget(decisions, ...forgetKeys);
    const rolls = decisions.hitPointRolls;
    const levels = next.reduce((n, c) => n + c.levels, 0);
    update({
      ...cleaned,
      classes: next,
      ...(rolls ? { hitPointRolls: rolls.slice(0, Math.max(0, levels - 1)) } : {}),
    });
  };
  const total = classes.reduce((n, c) => n + c.levels, 0);

  if (classes.length === 0)
    return (
      <ClassChooser
        edition={decisions.edition}
        isEnabled={(s) => props.isEnabled(s)}
        onAdd={(key) => {
          setClasses([{ class: key, levels: 1 }]);
        }}
      />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <div className="flex-1">
          <p className="text-lg font-bold">Character Level: {total}</p>
          <p className="text-sm text-muted">Milestone advancement</p>
        </div>
        {view && (
          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
            <div>
              <p>
                <span className="font-bold">Max Hit Points:</span> {view.sheet.hp.value}
              </p>
              <p>
                <span className="font-bold">Hit Dice:</span>{' '}
                {view.sheet.hitDice.map((h) => `${String(h.count)}d${String(h.faces)}`).join(' + ')}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setManagingHp(!managingHp);
              }}
            >
              Manage HP
            </Button>
          </div>
        )}
      </div>
      {managingHp && view && <HitPoints decisions={decisions} view={view} update={update} />}

      {classes.map((cl, i) => (
        <ClassPanel
          key={cl.class}
          {...props}
          index={i}
          levels={cl}
          maxLevel={MAX_LEVEL - (total - cl.levels)}
          onLevel={(levels) => {
            setClasses(classes.map((x, j) => (j === i ? { ...x, levels } : x)));
          }}
          onRemove={() => {
            const sub = view?.classes[i]?.subclass;
            setClasses(
              classes.filter((_, j) => j !== i),
              [cl.class, sub],
            );
          }}
        />
      ))}

      {total < MAX_LEVEL &&
        (adding ? (
          <ClassChooser
            edition={decisions.edition}
            isEnabled={(s) => props.isEnabled(s)}
            multiclass={{
              scores: Object.fromEntries(
                Object.entries(view?.sheet.abilities ?? {}).map(([a, l]) => [a, l.score.value]),
              ) as Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>,
              enforce: character.preferences.multiclassRequirements,
              taken: classes.map((c) => c.class),
            }}
            onCancel={() => {
              setAdding(false);
            }}
            onAdd={(key) => {
              setAdding(false);
              setClasses([...classes, { class: key, levels: 1 }]);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
            }}
            className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add another class
          </button>
        ))}
    </div>
  );
}

function ClassPanel({
  view,
  character,
  setPicks,
  isEnabled,
  index,
  levels,
  maxLevel,
  onLevel,
  onRemove,
}: ClassStepProps & {
  index: number;
  levels: ClassLevels;
  maxLevel: number;
  onLevel: (levels: number) => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<'features' | 'spells'>('features');
  const rows = useListRows('classes');
  const page = useClassPage(levels.class);
  const row = rows?.find((r) => r.key === levels.class);
  const built = view?.classes[index];
  const subKey = built?.subclass;
  const keys = [levels.class, ...(subKey ? [subKey] : [])];
  const name = built?.name ?? row?.name ?? 'Class';
  const subName = view?.entities.find((e) => e.key === subKey)?.name;
  const decisions = character.decisions;

  const choices = view?.choices ?? [];
  const grants = view?.grants ?? [];
  const featureKeyOf = (c: AnsweredChoice) => featureOf(c, choices, grants);
  const mine = (c: AnsweredChoice) =>
    keys.includes(c.from) || keys.some((k) => c.id.startsWith(`${k}/`));
  const spellLists = choices.filter((c) => mine(c) && isClassSpellList(c, keys));
  // Proficiency picks at level 1 belong to no feature: D&D Beyond's "Core <Class> Traits".
  const core = choices.filter(
    (c) =>
      mine(c) &&
      !featureKeyOf(c) &&
      !isClassSpellList(c, keys) &&
      !c.id.includes('/equipment') &&
      c.from === levels.class,
  );
  const features = (view?.features ?? [])
    .filter((f) => keys.includes(f.from) && !f.key.includes('#'))
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const later =
    page.status === 'found'
      ? page.page.features.filter((f) => f.level > levels.levels && !f.gainSubclass)
      : [];
  const fixed = grants
    .filter((g) => g.from === levels.class && !g.choice && 'value' in g)
    .map((g) =>
      'value' in g ? (g.kind === 'save' ? `${g.value.toUpperCase()} save` : g.value) : '',
    );
  const controls = (list: AnsweredChoice[]) =>
    list.map((c) => (
      <ChoiceControl
        key={c.id}
        choice={c}
        decisions={decisions}
        isEnabled={isEnabled}
        onChange={(picks) => {
          setPicks(c.id, picks);
        }}
      />
    ));
  const spellcasting = view?.sheet.spellcasting.filter((s) => keys.includes(s.from)) ?? [];

  return (
    <section aria-label={name} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-sunken" aria-hidden>
          {row?.card?.image && (
            <ArtImage
              path={row.card.image}
              widths={[96, 192]}
              sizes="48px"
              className="h-full w-full object-cover object-top"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl leading-tight">{name}</h2>
          {subName && <p className="text-sm text-muted">{subName}</p>}
        </div>
        <label className="flex items-center gap-2 font-bold">
          Level
          <select
            aria-label={index === 0 ? 'Level' : `${name} level`}
            value={levels.levels}
            onChange={(e) => {
              onLevel(Number(e.target.value));
            }}
            className="rounded-md border border-border bg-surface px-2 py-1.5 font-normal"
          >
            {Array.from({ length: maxLevel }, (_, n) => n + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => {
            if (window.confirm(`Remove ${name} and the choices made for it?`)) onRemove();
          }}
          className="rounded p-1 text-accent hover:bg-sunken"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div
        role="tablist"
        aria-label={`${name} sections`}
        className="flex gap-4 border-b border-border text-sm font-bold uppercase"
      >
        {(
          ['features', ...(spellLists.length || spellcasting.length ? ['spells'] : [])] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t as 'features' | 'spells');
            }}
            className={cn(
              '-mb-px border-b-2 py-1.5',
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            {t === 'features' ? 'Class features' : 'Spells'}
          </button>
        ))}
      </div>

      {tab === 'features' ? (
        <div className="space-y-2.5 pt-1">
          <Accordion
            title={`Core ${name} Traits`}
            subtitle={[choiceCount(core), ORDINAL(1)].filter(Boolean).join(' · ')}
            pending={core.some((c) => c.picks.length < c.count)}
          >
            {fixed.length > 0 && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">Proficiencies: </span>
                {fixed.join(', ')}
              </p>
            )}
            <div className="space-y-3">{controls(core)}</div>
          </Accordion>
          {features.map((f) => {
            const list = choices.filter(
              (c) => featureKeyOf(c) === f.key && !c.id.includes('/equipment'),
            );
            return (
              <Accordion
                key={f.key}
                title={f.name}
                subtitle={[choiceCount(list), f.level ? ORDINAL(f.level) : '']
                  .filter(Boolean)
                  .join(' · ')}
                pending={list.some((c) => c.picks.length < c.count)}
              >
                <FeatureText entityKey={f.key} />
                {list.length > 0 && <div className="mt-3 space-y-3">{controls(list)}</div>}
              </Accordion>
            );
          })}
          {later.length > 0 && (
            <Accordion title={`Available at higher levels (${String(later.length)})`}>
              <ul className="space-y-1 text-sm">
                {later.map((f) => (
                  <li key={f.key} className="flex gap-3">
                    <span className="w-20 shrink-0 text-muted">{ORDINAL(f.level)}</span>
                    {f.name}
                  </li>
                ))}
              </ul>
            </Accordion>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {spellcasting.map((s) => (
            <p key={s.from} className="flex flex-wrap gap-x-4 text-sm">
              <span>
                <span className="font-bold">Spell save DC</span> {s.dc.value}
              </span>
              <span>
                <span className="font-bold">Spell attack</span> {s.attack.value >= 0 ? '+' : ''}
                {s.attack.value}
              </span>
              {view && view.sheet.slots.length > 1 && (
                <span>
                  <span className="font-bold">Slots</span>{' '}
                  {view.sheet.slots
                    .slice(1)
                    .map((n, l) => `${ORDINAL(l + 1).replace(' level', '')}: ${String(n)}`)
                    .join(' · ')}
                </span>
              )}
              {view?.sheet.pact && (
                <span>
                  <span className="font-bold">Pact slots</span> {view.sheet.pact.slots} ×{' '}
                  {ORDINAL(view.sheet.pact.level)}
                </span>
              )}
            </p>
          ))}
          {spellLists.map((c) => (
            <SpellChoicePanel
              key={c.id}
              choice={c}
              decisions={decisions}
              isEnabled={isEnabled}
              onChange={(picks) => {
                setPicks(c.id, picks);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A feature's text, folded to a few lines. */
function FeatureText({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status !== 'found') return null;
  return (
    <div className="text-sm">
      <Clamp>
        <Entries entries={state.entity.data.entries} />
      </Clamp>
    </div>
  );
}

/** Hit points: the average for every level after the first, or rolls. */
function HitPoints({
  decisions,
  view,
  update,
}: {
  decisions: CharacterDecisions;
  view: CharacterView;
  update: (next: CharacterDecisions) => void;
}) {
  const levels = hitPointLevels(view.sheet.hitDice, view.classes);
  const rolls = decisions.hitPointRolls;
  const average = (faces: number) => faces / 2 + 1;
  const setRolls = (next: number[] | undefined) => {
    const { hitPointRolls: _old, ...rest } = decisions;
    update(next ? { ...rest, hitPointRolls: next } : rest);
  };
  return (
    <section aria-label="Hit points" className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h3 className="flex-1 font-serif text-lg font-bold">Hit points: {view.sheet.hp.value}</h3>
        <div
          role="radiogroup"
          aria-label="Hit points method"
          className="flex rounded-md border border-border p-0.5 text-sm"
        >
          {(['average', 'rolled'] as const).map((m) => {
            const on = m === 'rolled' ? rolls !== undefined : rolls === undefined;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setRolls(m === 'rolled' ? levels.map((l) => average(l.faces)) : undefined);
                }}
                className={cn(
                  'rounded px-2.5 py-1',
                  on ? 'bg-accent text-accent-fg' : 'hover:bg-sunken',
                )}
              >
                {m === 'average' ? 'Fixed' : 'Rolled'}
              </button>
            );
          })}
        </div>
      </div>
      {levels.length === 0 ? (
        <p className="text-sm text-muted">Level 1 takes the highest roll of the hit die.</p>
      ) : rolls === undefined ? (
        <p className="text-sm text-muted">
          Each level after the first adds the hit die&apos;s average and your Constitution modifier.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {levels.map((l, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm"
            >
              <span className="text-muted">{l.label}</span>
              <input
                type="number"
                min={1}
                max={l.faces}
                aria-label={`Hit point roll for ${l.label}`}
                value={rolls[i] ?? average(l.faces)}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(l.faces, Math.round(Number(e.target.value) || 1)));
                  setRolls(levels.map((x, j) => (j === i ? n : (rolls[j] ?? average(x.faces)))));
                }}
                className="w-14 rounded border border-border bg-surface px-1.5 py-0.5"
              />
              <button
                type="button"
                aria-label={`Roll d${String(l.faces)} for ${l.label}`}
                onClick={() => {
                  const n = secureRng(l.faces);
                  setRolls(levels.map((x, j) => (j === i ? n : (rolls[j] ?? average(x.faces)))));
                }}
                className="rounded p-0.5 text-muted hover:text-accent"
              >
                <Dices className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "6 Choices": every pick the choices ask for, as D&D Beyond counts them. */
function choiceCount(list: readonly AnsweredChoice[]): string {
  const n = list.reduce((sum, c) => sum + c.count, 0);
  return n ? `${String(n)} Choice${n === 1 ? '' : 's'}` : '';
}
