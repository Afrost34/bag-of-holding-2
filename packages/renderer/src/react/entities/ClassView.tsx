import { ABILITY_NAME, type Ability } from '@boh/data5e/format';
import type { ReactNode } from 'react';
import { Entries } from '../Entries';
import { RichText } from '../RichText';
import { useServices } from '../services';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const titleCase = (s: string) =>
  s.replace(/\b\w+/g, (w, offset: number) =>
    offset > 0 && /^(of|the|and|or)$/.test(w) ? w : cap(w),
  );
const abilityName = (code: string) =>
  (ABILITY_NAME as Partial<Record<string, string>>)[code] ?? code.toUpperCase();

/** "A, B, and C" */
function joinList(items: string[], conjunction = 'and'): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0] ?? ''} ${conjunction} ${items[1] ?? ''}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1) ?? ''}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${String(n)}${s[(v - 20) % 10] ?? s[v] ?? 'th'}`;
}

// region Class table

export interface TableFeature {
  level: number;
  name: string;
  /** Anchor id of the feature's section on the page, when it has one. */
  anchor?: string;
}

/** One cell of a 5etools class table group. */
function TableCell({ value, label }: { value: unknown; label: string }) {
  const { RollButton } = useServices();
  if (typeof value === 'number') return <>{value === 0 ? '—' : String(value)}</>;
  if (typeof value === 'string') return <RichText text={value} />;
  if (!isObj(value)) return <>—</>;
  switch (value.type) {
    case 'dice': {
      const expression = arr(value.toRoll)
        .filter(isObj)
        .map((d) => `${str(d.number)}d${str(d.faces)}`)
        .join(' + ');
      return <RollButton roll={{ kind: 'dice', expression, label }}>{expression}</RollButton>;
    }
    case 'bonus':
      return <>+{str(value.value)}</>;
    case 'bonusSpeed':
      return <>{value.value === 0 ? '—' : `+${str(value.value)} ft.`}</>;
    default:
      return <>{str(value.value) || '—'}</>;
  }
}

interface Group {
  title?: string;
  labels: string[];
  rows: unknown[][];
}

function tableGroups(groups: unknown): Group[] {
  return arr(groups)
    .filter(isObj)
    .map((g) => ({
      ...(typeof g.title === 'string' ? { title: g.title } : {}),
      labels: arr(g.colLabels).map(str),
      rows: arr(g.rows ?? g.rowsSpellProgression).map(arr),
    }));
}

/**
 * The class table: level, proficiency bonus, features gained, then the class's own columns
 * (and a subclass's, e.g. Eldritch Knight spell slots). Dice cells roll.
 */
export function ClassTable({
  name,
  data,
  features,
  extraGroups,
  renderFeature,
}: {
  name: string;
  data: Obj;
  features: readonly TableFeature[];
  extraGroups?: unknown;
  /** How a feature name is drawn (e.g. a link to its section). */
  renderFeature?: (feature: TableFeature) => ReactNode;
}) {
  const groups = [...tableGroups(data.classTableGroups), ...tableGroups(extraGroups)];
  const hasTitles = groups.some((g) => g.title);
  return (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">The {name} table</caption>
        <thead className="bg-surface-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
          {hasTitles && (
            <tr>
              <th colSpan={3} />
              {groups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.labels.length}
                  className="border-b border-border px-2 pt-2 text-center normal-case"
                >
                  {g.title ?? ''}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th className="px-3 py-2">Level</th>
            <th className="px-2 py-2">Proficiency Bonus</th>
            <th className="px-2 py-2">{name} Features</th>
            {groups.flatMap((g, gi) =>
              g.labels.map((label, li) => (
                <th key={`${String(gi)}-${String(li)}`} className="px-2 py-2 text-center">
                  <RichText text={label} />
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 20 }, (_, i) => {
            const level = i + 1;
            const gained = features.filter((f) => f.level === level);
            return (
              <tr key={level} className="border-t border-border even:bg-surface-2/50">
                <td className="px-3 py-1.5 font-semibold">{ordinal(level)}</td>
                <td className="px-2 py-1.5">+{Math.ceil(level / 4) + 1}</td>
                <td className="px-2 py-1.5">
                  {gained.length === 0
                    ? '—'
                    : gained.map((f, fi) => (
                        <span key={`${f.name}-${String(fi)}`}>
                          {fi > 0 && ', '}
                          {renderFeature ? renderFeature(f) : f.name}
                        </span>
                      ))}
                </td>
                {groups.flatMap((g, gi) =>
                  g.labels.map((label, li) => (
                    <td key={`${String(gi)}-${String(li)}`} className="px-2 py-1.5 text-center">
                      <TableCell value={g.rows[i]?.[li]} label={`${name} ${label}`} />
                    </td>
                  )),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// endregion

// region Core traits

function skillsText(skills: unknown): string {
  return arr(skills)
    .filter(isObj)
    .map((s) => {
      if (isObj(s.choose)) {
        const from = arr(s.choose.from).map((x) => titleCase(str(x)));
        return `Choose ${str(s.choose.count) || '1'}: ${joinList(from, 'or')}`;
      }
      if (typeof s.any === 'number') return `Choose any ${String(s.any)} skills`;
      return joinList(Object.keys(s).map(titleCase));
    })
    .join('; ');
}

const ARMOR_WEIGHTS = ['light', 'medium', 'heavy'];

function armorText(armor: unknown): string {
  const items = arr(armor).map((a) => (isObj(a) ? str(a.proficiency) : str(a)));
  const weights = items.filter((a) => ARMOR_WEIGHTS.includes(a.toLowerCase()));
  const parts: string[] = [];
  if (weights.length) parts.push(`${joinList(weights.map(cap))} armor`);
  for (const a of items) {
    if (ARMOR_WEIGHTS.includes(a.toLowerCase())) continue;
    parts.push(a.toLowerCase() === 'shield' ? 'Shields' : a);
  }
  return parts.join(' and ');
}

function weaponsText(weapons: unknown): string {
  const items = arr(weapons).map((w) => (isObj(w) ? str(w.proficiency) : str(w)));
  const kinds = items.filter((w) => w === 'simple' || w === 'martial');
  const others = items.filter((w) => w !== 'simple' && w !== 'martial');
  return [kinds.length ? `${joinList(kinds.map(cap))} weapons` : '', ...others]
    .filter(Boolean)
    .join(', ');
}

/** "Strength or Dexterity" (2024) or the multiclassing minimum (2014). */
function primaryAbility(data: Obj): string {
  const options = arr(data.primaryAbility).filter(isObj);
  if (options.length) {
    return options.map((o) => joinList(Object.keys(o).map(abilityName))).join(' or ');
  }
  const req = isObj(data.multiclassing) ? data.multiclassing.requirements : undefined;
  if (!isObj(req)) return '';
  if (Array.isArray(req.or)) {
    return req.or
      .filter(isObj)
      .flatMap((o) => Object.keys(o).map(abilityName))
      .join(' or ');
  }
  return joinList(
    Object.keys(req)
      .filter((k) => k in ABILITY_NAME)
      .map((k) => abilityName(k as Ability)),
  );
}

/** The "Core Fighter Traits" table: ability, hit points, proficiencies and starting gear. */
export function ClassTraits({
  name,
  data,
  edition,
}: {
  name: string;
  data: Obj;
  edition: '2014' | '2024';
}) {
  const faces = isObj(data.hd) ? Number(data.hd.faces) : 0;
  const prof = isObj(data.startingProficiencies) ? data.startingProficiencies : {};
  const equipment = isObj(data.startingEquipment) ? data.startingEquipment : {};
  const lower = name.toLowerCase();
  const rows: [string, ReactNode][] = [
    ['Primary Ability', primaryAbility(data)],
    ['Hit Point Die', faces ? `D${String(faces)} per ${name} level` : ''],
  ];
  if (edition === '2014' && faces) {
    rows.push(
      ['Hit Points at 1st Level', `${String(faces)} + your Constitution modifier`],
      [
        'Hit Points at Higher Levels',
        `1d${String(faces)} (or ${String(faces / 2 + 1)}) + your Constitution modifier per ${lower} level after 1st`,
      ],
    );
  }
  rows.push(
    ['Saving Throw Proficiencies', joinList(arr(data.proficiency).map((s) => abilityName(str(s))))],
    ['Skill Proficiencies', skillsText(prof.skills)],
    ['Weapon Proficiencies', weaponsText(prof.weapons)],
    ['Tool Proficiencies', arr(prof.tools).map(str).join(', ')],
    [edition === '2024' ? 'Armor Training' : 'Armor', armorText(prof.armor)],
  );
  const equipmentEntries = Array.isArray(equipment.entries)
    ? equipment.entries
    : Array.isArray(equipment.default)
      ? [{ type: 'list', items: equipment.default }]
      : undefined;
  if (equipmentEntries) {
    rows.push([
      'Starting Equipment',
      <div key="e" className="[&_p]:my-0">
        <Entries entries={equipmentEntries} depth={2} />
      </div>,
    ]);
  }

  const shown = rows.filter(([, value]) => value !== '');

  return (
    <div className="my-3 overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <caption className="border-b border-border bg-surface-2 px-3 py-2 text-left font-serif font-bold">
          Core {name} Traits
        </caption>
        <tbody>
          {shown.map(([label, value]) => (
            <tr key={label} className="border-t border-border first:border-0">
              <th className="w-1/3 px-3 py-2 text-left align-top font-semibold sm:w-56">{label}</th>
              <td className="px-3 py-2 align-top">
                {typeof value === 'string' ? <RichText text={value} /> : value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// endregion
