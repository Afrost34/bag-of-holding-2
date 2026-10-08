import { castingTime, spellRange } from '@boh/data5e/format';
import { ABILITIES, abilityName, type Ability } from '@boh/rules';
import { cn } from '@boh/ui';
import type { ReactNode } from 'react';
import type { CharacterFile } from '../../../app/characters/model';
import { PackedPages } from '../../../app/cards/PackedPages';
import type { CharacterView } from '../../../app/data/protocol';
import { ORDINAL, pageRows, sourceLabel } from './printText';
import type { PrintData } from './usePrintData';
import { SchoolIcon } from '../../../app/lists/cells';
import { PortraitImage } from '../Portrait';
import { pickName } from '../steps';
import type { PrintSection } from './sections';

/**
 * The character sheet on paper, in the layout of the owner's own sheets: a main page (portrait,
 * identity, combat, abilities, skills, attacks), spellcasting, equipment, features,
 * personality and backstory, then cards for every spell, feature and item. Each `.sheet-page`
 * is an A4 page; the whole thing is light, whatever the app theme (`.paper`).
 */

const SCHOOLS: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation',
  I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
}; // prettier-ignore
const ABBR: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};
const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const title = (s: string) =>
  s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

export function PrintSheet({
  character,
  view,
  data,
  hidden = [],
}: {
  character: CharacterFile;
  view: CharacterView;
  data: PrintData;
  /** Parts left out. */
  hidden?: readonly PrintSection[];
}) {
  const shown = (s: PrintSection) => !hidden.includes(s);
  const sheet = view.sheet;
  const { entities, spells } = data;
  const nameOf = (key: string) => view.entities.find((e) => e.key === key)?.name;

  const classLine = view.classes
    .map((c) => {
      const sub = c.subclass ? nameOf(c.subclass) : undefined;
      return `${c.name}${sub ? ` (${sub})` : ''} ${String(c.levels)}`;
    })
    .join(' / ');
  const species = nameOf(character.decisions.species ?? '') ?? '';
  const background = nameOf(character.decisions.background ?? '') ?? '';
  const caster = sheet.spellcasting[0];

  return (
    <div className="paper text-text">
      {/* Page 1: the main sheet, filling the A4 page top to bottom. */}
      {shown('main') && (
        <Page>
          <div className="flex h-full flex-col gap-2.5">
            <div className="grid grid-cols-[34%_1fr] gap-2.5">
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border-2 border-border-strong bg-surface-2">
                {character.portrait ? (
                  <PortraitImage character={character} size={260} className="h-full w-full" />
                ) : (
                  <span className="text-sm text-faint">Portrait</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Character name" value={character.name} strong />
                  <Field label="Class & level" value={classLine} strong />
                  <Field label="Species" value={species} />
                  <Field label="Background" value={background} />
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  <Stat label="Armor class" value={String(sheet.ac.value)} big />
                  <Stat label="Initiative" value={signed(sheet.initiative.value)} />
                  <Stat label="Speed" value={`${String(sheet.speed.walk ?? 30)} ft.`} />
                  <Stat label="Proficiency" value={signed(sheet.proficiencyBonus)} />
                  {caster ? (
                    <Stat label="Spell save DC" value={String(caster.dc.value)} />
                  ) : (
                    <Stat label="Passive perc." value={String(sheet.passive.perception.value)} />
                  )}
                  <Stat label="Inspiration" value="" />
                </div>
                <div className="grid grid-cols-[1fr_0.8fr_auto] gap-1.5">
                  <Box title="Hit points">
                    <div className="grid grid-cols-3 gap-1">
                      <Stat label="Current" value="" />
                      <Stat label="Max" value={String(sheet.hp.value)} big />
                      <Stat label="Temp" value="" />
                    </div>
                  </Box>
                  <Box title="Hit dice">
                    <div className="grid grid-cols-2 gap-1">
                      <Stat
                        label="Total"
                        value={sheet.hitDice
                          .map((h) => `${String(h.count)}d${String(h.faces)}`)
                          .join(' + ')}
                      />
                      <Stat label="Spent" value="" />
                    </div>
                  </Box>
                  <Box title="Death saves">
                    <div className="space-y-1.5 px-1 pt-1">
                      <Bubbles count={3} label="✓" />
                      <Bubbles count={3} label="✗" />
                    </div>
                  </Box>
                </div>
                <Box title="Proficiencies" grow>
                  <div className="grid grid-cols-2 gap-x-3">
                    <ProfLine
                      label="Armor"
                      items={sheet.proficiencies.armor.map((a) =>
                        `${title(a)} Armor`.replace('Shield Armor', 'Shields'),
                      )}
                    />
                    <ProfLine
                      label="Weapons"
                      items={sheet.proficiencies.weapons.map((w) =>
                        w.includes(':') ? pickName(w) : `${title(w)} Weapons`,
                      )}
                    />
                    <ProfLine label="Tools" items={sheet.proficiencies.tools.map(title)} />
                    <ProfLine label="Languages" items={sheet.proficiencies.languages.map(title)} />
                  </div>
                </Box>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[34%_1fr] gap-2.5">
              <div className="grid min-h-0 grid-cols-[32%_1fr] gap-2">
                <div className="flex flex-col justify-between gap-1.5">
                  {ABILITIES.map((a) => {
                    const line = sheet.abilities[a];
                    return (
                      <div
                        key={a}
                        className="overflow-hidden rounded-md border-2 bg-surface text-center"
                        style={{ borderColor: `var(--boh-${a})` }}
                      >
                        <p
                          className="py-0.5 text-[9px] font-bold text-white uppercase"
                          style={{ background: `var(--boh-${a})` }}
                        >
                          {ABBR[a]}
                        </p>
                        <p className="text-xl leading-tight font-bold">{signed(line.modifier)}</p>
                        <p className="text-xs text-muted">{line.score.value}</p>
                        <p
                          className={cn(
                            'border-t border-border py-0.5 text-[9px] text-muted',
                            line.save.proficient && 'font-bold text-text',
                          )}
                        >
                          Save {signed(line.save.value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <Box title="Skills" grow>
                  <ul className="flex h-full flex-col justify-between text-[10px]">
                    {Object.entries(sheet.skills).map(([skill, line]) => (
                      <li key={skill} className="flex items-center gap-1">
                        <ProfDot level={line.proficiency} />
                        <span className="w-6 text-right font-semibold">{signed(line.value)}</span>
                        <span className="flex-1 truncate">{title(skill)}</span>
                        <AbilityBadge ability={line.ability} />
                      </li>
                    ))}
                  </ul>
                </Box>
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                <Box title="Senses">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
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
                  </div>
                </Box>
                <Box title="Attacks & cantrips" grow>
                  <div className="flex h-full flex-col">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-[9px] text-muted uppercase">
                          <th className="py-0.5 text-left">Name</th>
                          <th>Abi</th>
                          <th>Hit / DC</th>
                          <th>Damage / type</th>
                          <th className="text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.attacks.map((atk) => {
                          const ability =
                            atk.save?.ability ??
                            atk.toHit?.parts[0]?.label.slice(0, 3).toLowerCase();
                          return (
                            <tr key={atk.key} className="border-t border-border">
                              <td className="py-1 font-semibold">{atk.name}</td>
                              <td className="text-center">
                                {ability && (ability as Ability) in ABBR ? (
                                  <AbilityBadge ability={ability as Ability} />
                                ) : (
                                  ''
                                )}
                              </td>
                              <td className="text-center font-semibold">
                                {atk.toHit
                                  ? signed(atk.toHit.value)
                                  : atk.save
                                    ? `DC ${String(atk.save.dc.value)}`
                                    : ''}
                              </td>
                              <td className="text-center">{atk.damage ?? ''}</td>
                              <td>
                                {atk.save
                                  ? `${ABBR[atk.save.ability]} save`
                                  : atk.properties.map(propertyName).join(', ')}
                                {atk.range ? ` (${atk.range})` : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Ruled lines for what is written in by hand, down to the foot of the page. */}
                    <div aria-hidden className="ruled min-h-0 flex-1 border-t border-border" />
                  </div>
                </Box>
              </div>
            </div>
          </div>
        </Page>
      )}

      {/* Page 2: spellcasting. */}
      {caster &&
        shown('spellcasting') &&
        pageRows(spells, 38, 46).map((part, page) => (
          <Page key={`spells-${String(page)}`}>
            <Box title={page === 0 ? 'Spellcasting' : 'Spellcasting (continued)'}>
              {page === 0 && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <Stat label="Spell abil." value={ABBR[caster.ability]} />
                    <Stat
                      label="Spell mod"
                      value={signed(sheet.abilities[caster.ability].modifier)}
                    />
                    <Stat label="Spell DC" value={String(caster.dc.value)} />
                    <Stat label="Spell atk" value={signed(caster.attack.value)} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sheet.slots.slice(1).map((n, i) =>
                      n > 0 ? (
                        <span
                          key={i}
                          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-bold"
                        >
                          {ORDINAL(i + 1)} <Bubbles count={n} />
                        </span>
                      ) : null,
                    )}
                    {sheet.pact && (
                      <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-bold">
                        Pact ({ORDINAL(sheet.pact.level)}) <Bubbles count={sheet.pact.slots} />
                      </span>
                    )}
                  </div>
                </>
              )}
              <table className="mt-2 w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase">
                    <th className="py-0.5">Lvl</th>
                    <th />
                    <th className="text-left">Name</th>
                    <th>Comp</th>
                    <th>Cast</th>
                    <th>Range</th>
                    <th>C</th>
                    <th>R</th>
                  </tr>
                </thead>
                <tbody>
                  {part.map((s) => {
                    const d = s.data;
                    const lvl = typeof d.level === 'number' ? d.level : 0;
                    const comps =
                      typeof d.components === 'object' && d.components !== null
                        ? Object.keys(d.components)
                            .filter((k) => ['v', 's', 'm'].includes(k))
                            .map((k) => k.toUpperCase())
                            .join(',')
                        : '';
                    const conc =
                      Array.isArray(d.duration) &&
                      d.duration.some(
                        (x: unknown) => typeof x === 'object' && x !== null && 'concentration' in x,
                      );
                    const ritual =
                      typeof d.meta === 'object' && d.meta !== null && 'ritual' in d.meta;
                    return (
                      <tr key={s.key} className="border-t border-border">
                        <td className="py-1 text-center font-bold">{lvl === 0 ? 'C' : lvl}</td>
                        <td className="w-6">
                          <SchoolIcon school={SCHOOLS[String(d.school)] ?? ''} />
                        </td>
                        <td className={cn(lvl === 0 && 'italic')}>{s.name}</td>
                        <td className="text-center">{comps}</td>
                        <td className="text-center">{castingTime(d)}</td>
                        <td className="text-center">{spellRange(d)}</td>
                        <td className="text-center">{conc ? '●' : ''}</td>
                        <td className="text-center">{ritual ? '●' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Page>
        ))}

      {/* Page 3: equipment. */}
      {shown('equipment') &&
        pageRows(character.decisions.inventory ?? [], 44, 46).map((part, page, all) => (
          <Page key={`equipment-${String(page)}`}>
            <Box title={page === 0 ? 'Equipment' : 'Equipment (continued)'}>
              {page === 0 && (
                <p className="mb-2 text-sm">
                  {(['pp', 'gp', 'ep', 'sp', 'cp'] as const)
                    .map((k) => `${k.toUpperCase()}: ${String(character.coins[k] || '___')}`)
                    .join('   ')}
                </p>
              )}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase">
                    <th className="w-10 py-0.5">Qty</th>
                    <th className="text-left">Item</th>
                    <th className="w-16">Wt.</th>
                    <th className="text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {part.map((it, i) => {
                    const e = entities.get(it.key);
                    const weight =
                      typeof e?.data.weight === 'number' ? `${String(e.data.weight)} lb` : '';
                    return (
                      <tr key={`${it.key}-${String(i)}`} className="border-t border-border">
                        <td className="py-1 text-center">{it.quantity}</td>
                        <td>{it.name ?? e?.name ?? pickName(it.key)}</td>
                        <td className="text-center">{weight}</td>
                        <td>
                          {[it.equipped ? 'Equipped' : '', it.attuned ? 'Attuned' : '']
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Empty lines to the foot of the last page, to write in. */}
                  {page === all.length - 1 &&
                    Array.from(
                      { length: Math.max(0, (page === 0 ? 44 : 46) - part.length) },
                      (_, i) => (
                        <tr key={`empty-${String(i)}`} className="h-5 border-t border-border">
                          <td colSpan={4} />
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </Box>
          </Page>
        ))}

      {/* Page 4: features. */}
      {shown('features') &&
        pageRows(data.features, 44, 46).map((part, page) => (
          <Page key={`features-${String(page)}`}>
            <Box title={page === 0 ? 'Features' : 'Features (continued)'}>
              {page === 0 && (
                <p className="mb-2 text-xs">
                  {Object.entries(sheet.senses)
                    .map(([k, v]) => `${title(k)} ${String(v)} ft.`)
                    .join(', ')}
                </p>
              )}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase">
                    <th className="py-0.5 text-left">Source</th>
                    <th className="text-left">Name</th>
                    <th className="w-10">Lvl</th>
                  </tr>
                </thead>
                <tbody>
                  {part.map((f) => (
                    <tr key={f.key} className="border-t border-border">
                      <td className="py-1 font-semibold">{sourceLabel(f.from, view)}</td>
                      <td>{f.name}</td>
                      <td className="text-center font-bold">{f.level ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Page>
        ))}

      {/* Page 5: personality and backstory. */}
      {shown('story') && (
        <Page>
          <Box title="Personality">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Personality traits', character.details.personality],
                  ['Ideals', character.details.ideals],
                  ['Bonds', character.details.bonds],
                  ['Flaws', character.details.flaws],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <p className="text-[9px] font-bold text-muted uppercase">{label}</p>
                  <p className="min-h-20 rounded border border-border p-2 text-xs whitespace-pre-wrap">
                    {text ?? ''}
                  </p>
                </div>
              ))}
            </div>
          </Box>
          <div className="mt-3">
            <Box title="Backstory">
              <p className="min-h-[150mm] text-[11px] leading-relaxed whitespace-pre-wrap">
                {character.details.backstory ?? ''}
              </p>
            </Box>
          </div>
        </Page>
      )}

      {/* Cards: spells by level, features and traits, items, packed into A4 pages. */}
      <PackedPages packing={data.packing} items={data.cards} label="Cards page" />
    </div>
  );
}

const PROPERTIES: Record<string, string> = {
  L: 'light', F: 'finesse', T: 'thrown', V: 'versatile', H: 'heavy', '2H': 'two-handed', R: 'reach',
  A: 'ammunition', LD: 'loading',
}; // prettier-ignore
const propertyName = (p: string) => PROPERTIES[p] ?? p;

/** One A4 page: exactly 210 × 297 mm on screen and on paper; what does not fit is cut. */
function Page({ children }: { children: ReactNode }) {
  return (
    <section className="sheet-page mx-auto mb-6 box-border h-[297mm] w-[210mm] overflow-hidden bg-surface p-[8mm] shadow-card">
      {children}
    </section>
  );
}

function Box({
  title: heading,
  grow = false,
  children,
}: {
  title: string;
  /** Takes the height left in its column. */
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border-strong bg-surface',
        grow && 'flex min-h-0 flex-1 flex-col',
      )}
    >
      <h3 className="bg-header px-2 py-0.5 font-serif text-[11px] font-bold tracking-wide text-header-fg uppercase">
        {heading}
      </h3>
      <div className={cn('p-1.5', grow && 'min-h-0 flex-1')}>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded border border-border-strong px-1.5 py-1">
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('min-h-5 font-bold', strong ? 'font-serif text-base' : 'text-sm')}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex min-h-12 flex-col items-center justify-center rounded border border-border-strong px-1 py-1 text-center">
      <p className={cn('font-bold', big ? 'text-2xl' : 'text-lg')}>{value}</p>
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
    </div>
  );
}

function ProfLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-1.5">
      <p className="text-[10px] font-bold uppercase">{label}</p>
      <p className="text-[11px]">{items.join(', ') || '—'}</p>
    </div>
  );
}

function Bubbles({ count, label }: { count: number; label?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {label && (
        <span
          className="w-3 text-[11px] font-bold"
          style={{ color: label === '✓' ? 'var(--boh-dex)' : 'var(--boh-str)' }}
        >
          {label}
        </span>
      )}
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="inline-block h-3 w-3 rounded-full border border-text" />
      ))}
    </span>
  );
}

function ProfDot({ level }: { level: 0 | 0.5 | 1 | 2 }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-text',
        level >= 1 && 'bg-text',
        level === 0.5 && 'bg-gradient-to-r from-text from-50% to-transparent to-50%',
        level === 2 && 'ring-2 ring-text ring-offset-1',
      )}
    />
  );
}

function AbilityBadge({ ability }: { ability: Ability }) {
  return (
    <span
      className="rounded px-1 text-[8px] font-bold text-white"
      style={{ background: `var(--boh-${ability})` }}
      title={abilityName(ability)}
    >
      {ABBR[ability]}
    </span>
  );
}
