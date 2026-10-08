import type { RollSpec } from '@boh/renderer';
import { ABILITIES, abilityName, type CharacterDecisions, type SheetValue } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { Info, Pencil, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import type { CharacterView } from '../../app/data/protocol';
import { RollChip } from '../../app/dice/RollChip';
import { pickName } from './steps';

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const d20 = (bonus: number, label: string): RollSpec => ({
  kind: 'd20',
  expression: `1d20${bonus ? (bonus > 0 ? ` + ${String(bonus)}` : ` - ${String(-bonus)}`) : ''}`,
  label,
});
const title = (s: string) =>
  s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

const PROFICIENCY_LABELS: Record<0 | 0.5 | 1 | 2, string> = {
  0: 'Not proficient',
  0.5: 'Half proficiency (Jack of All Trades)',
  1: 'Proficient',
  2: 'Expertise',
};

interface Selected {
  path: string;
  label: string;
  /** As it was when opened: shown until the sheet has the value again. */
  value: SheetValue;
}

/**
 * A value of the sheet by its override path, read from the sheet now: the details stay right
 * when the sheet is computed again (after setting a value by hand).
 */
function valueAt(sheet: CharacterView['sheet'], path: string): SheetValue | undefined {
  const [head, ...rest] = path.split('.');
  const tail = rest.join('.');
  switch (head) {
    case 'ac':
      return sheet.ac;
    case 'hp':
      return sheet.hp;
    case 'initiative':
      return sheet.initiative;
    case 'passive':
      return tail === 'perception' ? sheet.passive.perception : undefined;
    case 'score':
    case 'save': {
      const a = ABILITIES.find((x) => x === tail);
      if (!a) return undefined;
      return head === 'score' ? sheet.abilities[a].score : sheet.abilities[a].save;
    }
    case 'skill':
      return sheet.skills[tail];
    case 'spell':
      return sheet.spellcasting.find((x) => `dc.${x.from}` === tail)?.dc;
    default:
      return undefined;
  }
}

/**
 * The character sheet: every number from the rules engine. Rolls are a click away; the ⓘ next to
 * a number shows where it comes from and lets you set it by hand (the rules value stays visible).
 */
export function SheetView({
  view,
  decisions,
  abilityDisplay = 'modifiers',
  update,
}: {
  view: CharacterView;
  decisions: CharacterDecisions;
  /** Which the ability blocks show large. */
  abilityDisplay?: 'modifiers' | 'scores';
  update: (next: CharacterDecisions) => void;
}) {
  const sheet = view.sheet;
  const [selected, setSelected] = useState<Selected | null>(null);
  const open = (path: string, label: string, value: SheetValue) => {
    setSelected({ path, label, value });
  };
  const setOverride = (path: string, value: number | null) => {
    const overrides = { ...(decisions.overrides ?? {}) };
    if (value === null) Reflect.deleteProperty(overrides, path);
    else overrides[path] = value;
    update({ ...decisions, overrides });
    setSelected(null);
  };
  const spells = view.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : []));
  const slots = sheet.slots.slice(1);

  return (
    <div className="space-y-5">
      {selected && (
        <ValueDetails
          selected={{ ...selected, value: valueAt(sheet, selected.path) ?? selected.value }}
          onClose={() => {
            setSelected(null);
          }}
          onSet={setOverride}
        />
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat
          label="Armor Class"
          value={sheet.ac}
          onInfo={() => {
            open('ac', 'Armor Class', sheet.ac);
          }}
        />
        <Stat
          label="Hit Points"
          value={sheet.hp}
          onInfo={() => {
            open('hp', 'Hit Points', sheet.hp);
          }}
        />
        <Stat
          label="Initiative"
          value={sheet.initiative}
          shown={signed(sheet.initiative.value)}
          roll={d20(sheet.initiative.value, 'Initiative')}
          onInfo={() => {
            open('initiative', 'Initiative', sheet.initiative);
          }}
        />
        <Stat
          label="Speed"
          value={{ value: sheet.speed.walk ?? 30, parts: [] }}
          shown={`${String(sheet.speed.walk ?? 30)} ft.`}
        />
        <Stat
          label="Proficiency"
          value={{ value: sheet.proficiencyBonus, parts: [] }}
          shown={signed(sheet.proficiencyBonus)}
        />
        <Stat
          label="Passive Perception"
          value={sheet.passive.perception}
          onInfo={() => {
            open('passive.perception', 'Passive Perception', sheet.passive.perception);
          }}
        />
      </div>

      <Block title="Abilities">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ABILITIES.map((a) => {
            const line = sheet.abilities[a];
            const name = abilityName(a);
            return (
              <div key={a} className="rounded-lg border border-border p-2 text-center">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{name}</p>
                <RollChip plain roll={d20(line.check.value, `${name} check`)}>
                  <span className="text-2xl font-bold">
                    {abilityDisplay === 'scores' ? line.score.value : signed(line.modifier)}
                  </span>
                </RollChip>
                <p className="flex items-center justify-center gap-1 text-sm">
                  {abilityDisplay === 'scores' ? signed(line.modifier) : line.score.value}
                  <InfoButton
                    label={`${name} score`}
                    onClick={() => {
                      open(`score.${a}`, `${name} score`, line.score);
                    }}
                  />
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 border-t border-border pt-1 text-xs text-muted">
                  Save{' '}
                  <RollChip plain roll={d20(line.save.value, `${name} save`)}>
                    <span className={cn(line.save.proficient && 'font-bold text-text')}>
                      {signed(line.save.value)}
                    </span>
                  </RollChip>
                  <InfoButton
                    label={`${name} save`}
                    onClick={() => {
                      open(`save.${a}`, `${name} save`, line.save);
                    }}
                  />
                </p>
              </div>
            );
          })}
        </div>
      </Block>

      <div className="grid gap-5 md:grid-cols-2">
        <Block title="Skills">
          <ul className="divide-y divide-border">
            {Object.entries(sheet.skills).map(([skill, line]) => (
              <li key={skill} className="flex items-center gap-2 py-1 text-sm">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full border border-text',
                    line.proficiency >= 1 && 'bg-text',
                    line.proficiency === 2 && 'ring-2 ring-accent',
                    line.proficiency === 0.5 && 'bg-gradient-to-r from-text to-transparent',
                  )}
                  title={PROFICIENCY_LABELS[line.proficiency]}
                  aria-hidden
                />
                <span className="flex-1">
                  {title(skill)}{' '}
                  <span className="text-xs text-muted uppercase">{line.ability}</span>
                </span>
                <RollChip plain roll={d20(line.value, title(skill))}>
                  {signed(line.value)}
                </RollChip>
                <InfoButton
                  label={title(skill)}
                  onClick={() => {
                    open(`skill.${skill}`, title(skill), line);
                  }}
                />
              </li>
            ))}
          </ul>
        </Block>

        <div className="space-y-5">
          <Block title="Attacks">
            {sheet.attacks.length === 0 ? (
              <p className="text-sm text-muted">Equip a weapon in Equipment to see its attack.</p>
            ) : (
              <ul className="divide-y divide-border">
                {sheet.attacks.map((atk) => (
                  <li
                    key={atk.key}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-sm"
                  >
                    <AppLink
                      to={entityPath(atk.key)}
                      className="flex-1 font-medium hover:text-accent-ink"
                    >
                      {atk.name}
                    </AppLink>
                    {atk.toHit && (
                      <RollChip plain roll={d20(atk.toHit.value, `${atk.name} attack`)}>
                        {signed(atk.toHit.value)}
                      </RollChip>
                    )}
                    {atk.save && (
                      <span>
                        DC {atk.save.dc.value} {atk.save.ability.toUpperCase()}
                      </span>
                    )}
                    {atk.damage && (
                      <RollChip
                        roll={{
                          kind: 'damage',
                          expression: atk.damage.split(' ')[0] ?? atk.damage,
                          label: atk.name,
                        }}
                      >
                        {atk.damage}
                      </RollChip>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {sheet.spellcasting.length > 0 && (
            <Block title="Spellcasting">
              {sheet.spellcasting.map((s) => (
                <p key={s.from} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="flex items-center gap-1">
                    Save DC <strong>{s.dc.value}</strong>
                    <InfoButton
                      label={`${s.name} spell save DC`}
                      onClick={() => {
                        open(`spell.dc.${s.from}`, 'Spell save DC', s.dc);
                      }}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    Attack{' '}
                    <RollChip plain roll={d20(s.attack.value, 'Spell attack')}>
                      {signed(s.attack.value)}
                    </RollChip>
                  </span>
                  <span className="text-muted">{abilityName(s.ability)}</span>
                </p>
              ))}
              {slots.length > 0 && (
                <p className="mt-2 text-sm">
                  Slots:{' '}
                  {slots.map((n, i) => (
                    <span key={i} className="mr-2 inline-block rounded border border-border px-1.5">
                      {i + 1}: {n}
                    </span>
                  ))}
                </p>
              )}
              {sheet.pact && (
                <p className="text-sm">
                  Pact slots: {sheet.pact.slots} of level {sheet.pact.level}
                </p>
              )}
              {spells.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {spells.map((key) => (
                    <li key={key}>
                      <AppLink
                        to={entityPath(key)}
                        className="rounded-full border border-border px-2 py-0.5 text-sm hover:border-accent"
                      >
                        {pickName(key)}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          <Block title="Proficiencies">
            <dl className="space-y-1 text-sm">
              <Row label="Armor" items={sheet.proficiencies.armor} />
              <Row
                label="Weapons"
                items={sheet.proficiencies.weapons.map((w) => (w.includes(':') ? pickName(w) : w))}
              />
              <Row label="Tools" items={sheet.proficiencies.tools} />
              <Row label="Languages" items={sheet.proficiencies.languages} />
              <Row
                label="Senses"
                items={Object.entries(sheet.senses).map(([k, v]) => `${k} ${String(v)} ft.`)}
              />
              <Row label="Resistances" items={sheet.defences.resist} />
              <Row
                label="Immunities"
                items={[...sheet.defences.immune, ...sheet.defences.conditionImmune]}
              />
              <Row
                label="Hit dice"
                items={sheet.hitDice.map((h) => `${String(h.count)}d${String(h.faces)}`)}
              />
            </dl>
          </Block>

          {sheet.classTable.length > 0 && (
            <Block title="Class">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {sheet.classTable.map((c) => (
                  <div key={`${c.from}:${c.label}`}>
                    <dt className="text-xs text-muted">{c.label}</dt>
                    <dd className="font-medium">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </Block>
          )}
        </div>
      </div>

      <Block title="Features and traits">
        <ul className="flex flex-wrap gap-1.5">
          {view.features.map((f) => (
            <li key={f.key}>
              {f.key.includes('#') ? (
                <span className="inline-block rounded-full border border-border px-2 py-0.5 text-sm">
                  {f.name}
                </span>
              ) : (
                <AppLink
                  to={entityPath(f.key)}
                  className="inline-block rounded-full border border-border px-2 py-0.5 text-sm hover:border-accent"
                >
                  {f.name}
                </AppLink>
              )}
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}

function Block({ title: heading, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={heading} className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 font-serif text-lg font-bold">{heading}</h3>
      {children}
    </section>
  );
}

function Row({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd>{items.map((i) => title(i)).join(', ')}</dd>
    </div>
  );
}

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Details: ${label}`}
      onClick={onClick}
      className="rounded p-0.5 text-faint hover:text-accent-ink"
    >
      <Info className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function Stat({
  label,
  value,
  shown,
  roll,
  onInfo,
}: {
  label: string;
  value: SheetValue;
  shown?: string;
  roll?: RollSpec;
  onInfo?: () => void;
}) {
  const text = shown ?? String(value.value);
  return (
    <div className="rounded-lg border border-border bg-surface p-2 text-center">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('text-2xl font-bold', value.computed !== undefined && 'text-accent-ink')}>
        {roll ? (
          <RollChip plain roll={roll}>
            {text}
          </RollChip>
        ) : (
          text
        )}
      </p>
      {onInfo && <InfoButton label={label} onClick={onInfo} />}
    </div>
  );
}

/** Where a number comes from, and a way to set it by hand. */
function ValueDetails({
  selected,
  onClose,
  onSet,
}: {
  selected: Selected;
  onClose: () => void;
  onSet: (path: string, value: number | null) => void;
}) {
  const { value } = selected;
  const [typed, setTyped] = useState(String(value.value));
  return (
    <section
      aria-label={`${selected.label} details`}
      className="rounded-lg border border-accent bg-surface p-4"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex-1 font-serif text-lg font-bold">{selected.label}</h3>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="rounded p-1 hover:bg-sunken"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="mb-3 space-y-0.5 text-sm">
        {value.parts.map((p, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span>{p.label}</span>
            <span className="font-medium">{i === 0 ? p.value : signed(p.value)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 border-t border-border pt-0.5 font-bold">
          <span>{value.computed !== undefined ? 'By the rules' : 'Total'}</span>
          <span>{value.computed ?? value.value}</span>
        </li>
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(typed);
          if (Number.isFinite(n)) onSet(selected.path, Math.round(n));
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block font-medium">Set by hand</span>
          <input
            type="number"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
        <Button type="submit" variant="primary">
          <Pencil className="h-4 w-4" aria-hidden /> Set
        </Button>
        {value.computed !== undefined && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onSet(selected.path, null);
            }}
          >
            Use the rules value ({value.computed})
          </Button>
        )}
      </form>
    </section>
  );
}
