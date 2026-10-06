import { cn } from '@boh/ui';
import { Fragment, type ReactNode } from 'react';
import {
  ABILITIES,
  ABILITY_NAME,
  abilityMod,
  alignment,
  armorClass,
  challenge,
  creatureType,
  crValue,
  damageList,
  proficiencyForCr,
  signed,
  sizeText,
  speed,
  type Ability,
} from '../../format';
import { text } from '../../json';
import { Entries } from '../Entries';
import { RichText } from '../RichText';
import { RollLabel, useServices } from '../services';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Literal class names so Tailwind can see them (it cannot read `text-${a}`). */
const ABILITY_COLOR: Record<Ability, string> = {
  str: 'text-str',
  dex: 'text-dex',
  con: 'text-con',
  int: 'text-int',
  wis: 'text-wis',
  cha: 'text-cha',
};

function d20(mod: number): string {
  return mod === 0 ? '1d20' : mod > 0 ? `1d20 + ${String(mod)}` : `1d20 - ${String(-mod)}`;
}

/** A creature statblock in the modern (2024) layout, used for both editions. */
export function CreatureStatblock({ data, edition }: { data: Obj; edition: '2014' | '2024' }) {
  const { RollButton } = useServices();
  const name = typeof data.name === 'string' ? data.name : '';
  const cr = crValue(data.cr);
  const pb = cr ? proficiencyForCr(cr) : 2;
  const score = (a: Ability) => (typeof data[a] === 'number' ? data[a] : 10);
  const saves = isObj(data.save) ? data.save : {};
  const hp = isObj(data.hp) ? data.hp : {};

  const initiative = (() => {
    const dex = abilityMod(score('dex'));
    const init = data.initiative;
    if (typeof init === 'number') return init;
    if (isObj(init) && typeof init.proficiency === 'number') return dex + pb * init.proficiency;
    return dex;
  })();

  const lines: [string, ReactNode][] = [];
  const add = (label: string, value: ReactNode, show = true) => {
    if (show) lines.push([label, value]);
  };
  const skillEntries = isObj(data.skill)
    ? Object.entries(data.skill).filter(([k]) => k !== 'other')
    : [];
  add(
    'Skills',
    skillEntries.map(([skill, bonus], i) => (
      <Fragment key={skill}>
        {i > 0 && ', '}
        {skill.replace(/\b\w/g, (c) => c.toUpperCase())}{' '}
        <RollButton
          roll={{
            kind: 'd20',
            expression: d20(Number(String(bonus).replace('−', '-'))),
            label: `${name}: ${skill}`,
          }}
        >
          {String(bonus)}
        </RollButton>
      </Fragment>
    )),
    skillEntries.length > 0,
  );
  add(
    'Vulnerabilities',
    <RichText text={damageList(data.vulnerable, 'vulnerable')} />,
    data.vulnerable !== undefined,
  );
  add(
    'Resistances',
    <RichText text={damageList(data.resist, 'resist')} />,
    data.resist !== undefined,
  );
  add(
    'Immunities',
    <RichText
      text={[damageList(data.immune, 'immune'), damageList(data.conditionImmune, 'conditionImmune')]
        .filter(Boolean)
        .join('; ')}
    />,
    data.immune !== undefined || data.conditionImmune !== undefined,
  );
  if (Array.isArray(data.gear)) {
    add(
      'Gear',
      <RichText
        text={arr(data.gear)
          .map((g) =>
            typeof g === 'string'
              ? `{@item ${g}}`
              : isObj(g)
                ? `${text(g.quantity)} {@item ${text(g.item)}}`
                : '',
          )
          .join(', ')}
      />,
    );
  }
  add(
    'Senses',
    <RichText
      text={[
        ...arr(data.senses).map(String),
        `Passive Perception ${text(data.passive) || '10'}`,
      ].join(', ')}
    />,
  );
  add('Languages', <RichText text={arr(data.languages).map(String).join(', ') || '—'} />);
  add('CR', <RichText text={challenge(data.cr)} />, cr !== undefined);

  const spellcasting = arr(data.spellcasting).filter(isObj);
  const castingAs = (where: string) =>
    spellcasting.filter((s) => (typeof s.displayAs === 'string' ? s.displayAs : 'trait') === where);

  return (
    <RollLabel label={name}>
      <div className="text-[15px] leading-snug">
        <p className="text-sm text-muted italic">
          {sizeText(data.size)} {creatureType(data.type)}
          {data.alignment !== undefined && `, ${alignment(data.alignment)}`}
        </p>

        <div className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-y border-accent/40 py-2">
          <span className="font-bold">AC</span>
          <span>
            <RichText text={armorClass(data.ac)} />
            <span className="ml-4 font-bold">Initiative</span>{' '}
            <RollButton
              roll={{ kind: 'd20', expression: d20(initiative), label: `${name}: initiative` }}
            >
              {signed(initiative)} ({String(10 + initiative)})
            </RollButton>
          </span>
          <span className="font-bold">HP</span>
          <span>
            {typeof hp.special === 'string' ? (
              hp.special
            ) : (
              <>
                {text(hp.average)}{' '}
                {typeof hp.formula === 'string' && (
                  <>
                    (
                    <RollButton
                      roll={{ kind: 'dice', expression: hp.formula, label: `${name}: hit points` }}
                    >
                      {hp.formula}
                    </RollButton>
                    )
                  </>
                )}
              </>
            )}
          </span>
          <span className="font-bold">Speed</span>
          <span>{speed(data.speed)}</span>
        </div>

        <table className="my-2 w-full text-center text-sm">
          <thead>
            <tr className="text-xs text-muted uppercase">
              <th />
              <th className="font-semibold">Score</th>
              <th className="font-semibold">Mod</th>
              <th className="font-semibold">Save</th>
            </tr>
          </thead>
          <tbody>
            {ABILITIES.map((a) => {
              const mod = abilityMod(score(a));
              const save = saves[a] !== undefined ? Number(text(saves[a]).replace('−', '-')) : mod;
              return (
                <tr key={a} className={cn('odd:bg-surface-2')}>
                  <th className={cn('px-1 text-left font-bold uppercase', ABILITY_COLOR[a])}>
                    {a}
                  </th>
                  <td>{score(a)}</td>
                  <td>
                    <RollButton
                      roll={{
                        kind: 'd20',
                        expression: d20(mod),
                        label: `${name}: ${ABILITY_NAME[a]} check`,
                      }}
                    >
                      {signed(mod)}
                    </RollButton>
                  </td>
                  <td className={cn(saves[a] !== undefined && 'font-semibold')}>
                    <RollButton
                      roll={{
                        kind: 'd20',
                        expression: d20(save),
                        label: `${name}: ${ABILITY_NAME[a]} save`,
                      }}
                    >
                      {signed(save)}
                    </RollButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {lines.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="font-bold">{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>

        <Section title="Traits" entries={[...arr(data.trait), ...castingAs('trait')]} />
        <Section title="Actions" entries={[...arr(data.action), ...castingAs('action')]} />
        <Section title="Bonus Actions" entries={[...arr(data.bonus), ...castingAs('bonus')]} />
        <Section title="Reactions" entries={[...arr(data.reaction), ...castingAs('reaction')]} />
        <Section
          title="Legendary Actions"
          intro={legendaryIntro(data, name, edition)}
          entries={[...arr(data.legendary), ...castingAs('legendary')]}
        />
        <Section title="Mythic Actions" intro={arr(data.mythicHeader)} entries={arr(data.mythic)} />
        {arr(data.variant).length > 0 && <Entries entries={data.variant} depth={1} />}
      </div>
    </RollLabel>
  );
}

function legendaryIntro(data: Obj, name: string, edition: '2014' | '2024'): unknown[] {
  if (Array.isArray(data.legendaryHeader)) return data.legendaryHeader;
  if (!Array.isArray(data.legendary)) return [];
  const short =
    data.isNamedCreature === true ? (name.split(' ')[0] ?? name) : `the ${name.toLowerCase()}`;
  const uses = typeof data.legendaryActions === 'number' ? data.legendaryActions : 3;
  if (edition === '2024') {
    const lair =
      typeof data.legendaryActionsLair === 'number'
        ? ` (${String(data.legendaryActionsLair)} in Lair)`
        : '';
    return [
      `{@i Legendary Action Uses: ${String(uses)}${lair}.} Immediately after another creature's turn, ${short} can expend a use to take one of the following actions. ${short.charAt(0).toUpperCase()}${short.slice(1)} regains all expended uses at the start of each of its turns.`,
    ];
  }
  return [
    `${short.charAt(0).toUpperCase()}${short.slice(1)} can take ${String(uses)} legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. ${short.charAt(0).toUpperCase()}${short.slice(1)} regains spent legendary actions at the start of its turn.`,
  ];
}

function Section({
  title,
  intro = [],
  entries,
}: {
  title: string;
  intro?: unknown[];
  entries: unknown[];
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-3">
      <h4 className="mb-1 border-b border-accent/40 font-serif text-base font-bold text-accent">
        {title}
      </h4>
      <Entries entries={intro} depth={2} />
      {entries.map((entry, i) => (
        <Entries
          key={i}
          entries={[isObj(entry) && !entry.type ? { ...entry, type: 'entries' } : entry]}
          depth={2}
        />
      ))}
    </section>
  );
}
