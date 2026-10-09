import type { RollSpec } from '@boh/renderer';
import { ABILITIES, abilityName, type CharacterDecisions, type SheetValue } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { Info, Pencil, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import type { CharacterView } from '../../app/data/protocol';
import { RollChip } from '../../app/dice/RollChip';
import { SchoolIcon } from '../../app/lists/cells';
import { sheetSpells, type SheetSpell } from './sheetSpells';
import { pickName } from './steps';
import { signed, titleWords as title, ordinal } from '../../app/format';

const d20 = (bonus: number, label: string): RollSpec => ({
  kind: 'd20',
  expression: `1d20${bonus ? (bonus > 0 ? ` + ${String(bonus)}` : ` - ${String(-bonus)}`) : ''}`,
  label,
});

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
    case 'save':
    case 'check': {
      const a = ABILITIES.find((x) => x === tail);
      if (!a) return undefined;
      const line = sheet.abilities[a];
      return head === 'score' ? line.score : head === 'check' ? line.check : line.save;
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
 * The character sheet, laid out like the printed one: combat numbers across the top, abilities
 * and skills on the left, senses, attacks and proficiencies on the right, then spells and
 * features. Rolls are a click away; the ⓘ next to a number shows where it comes from and lets
 * you set it by hand (the rules value stays visible).
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
  const nameOf = (key: string) => view.entities.find((e) => e.key === key)?.name ?? pickName(key);
  const spells = sheetSpells(view.grants, nameOf);
  const slots = sheet.slots.slice(1);

  // Two columns only where the sheet itself is wide (a container query: the sidebar takes room).
  return (
    <div className="@container space-y-3">
      {selected && (
        <ValueDetails
          selected={{ ...selected, value: valueAt(sheet, selected.path) ?? selected.value }}
          onClose={() => {
            setSelected(null);
          }}
          onSet={setOverride}
        />
      )}

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
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

      <div className="grid gap-3 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
          <section aria-label="Abilities" className="flex flex-col gap-1.5">
            {ABILITIES.map((a) => {
              const line = sheet.abilities[a];
              const name = abilityName(a);
              return (
                <div
                  key={a}
                  className="overflow-hidden rounded-md border-2 bg-surface text-center"
                  style={{ borderColor: `var(--boh-${a})` }}
                >
                  <p
                    className="pt-0.5 text-[10px] font-bold tracking-wide uppercase"
                    style={{ color: `var(--boh-${a})` }}
                  >
                    {name}
                  </p>
                  <RollChip plain roll={d20(line.check.value, `${name} check`)}>
                    <span className="text-xl leading-tight font-bold">
                      {abilityDisplay === 'scores' ? line.score.value : signed(line.modifier)}
                    </span>
                  </RollChip>
                  <p className="flex items-center justify-center gap-0.5 text-xs text-muted">
                    {abilityDisplay === 'scores' ? signed(line.modifier) : line.score.value}
                    <InfoButton
                      label={`${name} score`}
                      onClick={() => {
                        open(`score.${a}`, `${name} score`, line.score);
                      }}
                    />
                  </p>
                  {/* An item or feature adding to checks (Stone of Good Luck): checks differ. */}
                  {line.check.value !== line.modifier && (
                    <p className="flex items-center justify-center gap-0.5 border-t border-border py-0.5 text-[11px] text-muted">
                      Check{' '}
                      <RollChip plain roll={d20(line.check.value, `${name} check`)}>
                        <span className="font-bold text-text">{signed(line.check.value)}</span>
                      </RollChip>
                      <InfoButton
                        label={`${name} check`}
                        onClick={() => {
                          open(`check.${a}`, `${name} check`, line.check);
                        }}
                      />
                    </p>
                  )}
                  <p className="flex items-center justify-center gap-0.5 border-t border-border py-0.5 text-[11px] text-muted">
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
          </section>
          <Block title="Skills">
            <ul className="divide-y divide-border">
              {Object.entries(sheet.skills).map(([skill, line]) => (
                <li key={skill} className="flex items-center gap-1.5 py-0.5 text-sm">
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
                  <RollChip plain roll={d20(line.value, title(skill))}>
                    <span className="inline-block w-7 text-right font-semibold">
                      {signed(line.value)}
                    </span>
                  </RollChip>
                  <span className="min-w-0 flex-1 truncate">{title(skill)}</span>
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: `var(--boh-${line.ability})` }}
                  >
                    {line.ability}
                  </span>
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
        </div>

        <div className="space-y-3">
          <Block title="Senses">
            <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
              <span>
                Passive Perception <strong>{sheet.passive.perception.value}</strong>
              </span>
              <span>
                Insight <strong>{sheet.passive.insight.value}</strong>
              </span>
              <span>
                Investigation <strong>{sheet.passive.investigation.value}</strong>
              </span>
              {Object.entries(sheet.senses).map(([k, v]) => (
                <span key={k}>
                  {title(k)} <strong>{v} ft.</strong>
                </span>
              ))}
            </p>
          </Block>

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

          <Block title="Proficiencies">
            <dl className="space-y-1 text-sm">
              <Row label="Armor" items={sheet.proficiencies.armor} />
              <Row
                label="Weapons"
                items={sheet.proficiencies.weapons.map((w) => (w.includes(':') ? pickName(w) : w))}
              />
              <Row label="Tools" items={sheet.proficiencies.tools} />
              <Row label="Languages" items={sheet.proficiencies.languages} />
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

      {(sheet.spellcasting.length > 0 || spells.length > 0) && (
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
          {(slots.some((n) => n > 0) || sheet.pact) && (
            <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
              {slots.map((n, i) =>
                n > 0 ? (
                  <span key={i} className="rounded-full border border-border px-2">
                    {ordinal(i + 1)}: <strong>{n}</strong>
                  </span>
                ) : null,
              )}
              {sheet.pact && (
                <span className="rounded-full border border-border px-2">
                  Pact ({ordinal(sheet.pact.level)}): <strong>{sheet.pact.slots}</strong>
                </span>
              )}
            </p>
          )}
          {spells.length > 0 && <SpellTable spells={spells} />}
        </Block>
      )}

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

/** The character's spells by level, as on the printed sheet, with how and whence each is had. */
function SpellTable({ spells }: { spells: SheetSpell[] }) {
  const rows = useListRows('spells');
  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
  const levelOf = (key: string) => Number(byKey.get(key)?.f.level ?? 0);
  const text = (key: string, field: string) => {
    const f = byKey.get(key)?.f;
    const v = f?.[`${field}Text`] ?? f?.[field];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };
  const sorted = [...spells].sort(
    (a, b) =>
      levelOf(a.key) - levelOf(b.key) || pickName(a.key).localeCompare(pickName(b.key), 'en'),
  );
  return (
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] text-muted uppercase">
          <th className="w-10 py-0.5 text-center">Lvl</th>
          <th className="w-6">
            <span className="sr-only">School</span>
          </th>
          <th>Name</th>
          <th>Had as</th>
          <th className="hidden sm:table-cell">From</th>
          <th className="hidden md:table-cell">Cast</th>
          <th className="hidden md:table-cell">Range</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => {
          const row = byKey.get(s.key);
          const lvl = levelOf(s.key);
          return (
            <tr key={s.key} className="border-t border-border">
              <td className="py-1 text-center font-bold">{lvl === 0 ? 'C' : lvl}</td>
              <td>{row && <SchoolIcon small school={String(row.f.school ?? '')} />}</td>
              <td>
                <AppLink to={entityPath(s.key)} className="font-medium hover:text-accent-ink">
                  {row?.name ?? pickName(s.key)}
                </AppLink>
              </td>
              <td>{s.how}</td>
              <td className="hidden text-muted sm:table-cell">{s.from}</td>
              <td className="hidden md:table-cell">{text(s.key, 'time')}</td>
              <td className="hidden md:table-cell">{text(s.key, 'range')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Block({ title: heading, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={heading}
      className="overflow-hidden rounded-md border border-border-strong bg-surface"
    >
      <h3 className="bg-header px-3 py-1 font-serif text-xs font-bold tracking-wide text-header-fg uppercase">
        {heading}
      </h3>
      <div className="p-3">{children}</div>
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

/** A number in a box with its label below, as on the printed sheet. */
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
    <div className="flex flex-col items-center justify-center rounded-md border border-border-strong bg-surface p-1.5 text-center">
      <p className={cn('text-2xl font-bold', value.computed !== undefined && 'text-accent-ink')}>
        {roll ? (
          <RollChip plain roll={roll}>
            {text}
          </RollChip>
        ) : (
          text
        )}
      </p>
      <p className="flex items-center gap-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
        {label}
        {onInfo && <InfoButton label={label} onClick={onInfo} />}
      </p>
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
