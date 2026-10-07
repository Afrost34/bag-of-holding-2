import type { EntityDetail } from '@boh/data5e';
import { castingTime, spellDuration, spellRange } from '@boh/data5e/format';
import { Entries, EntityView } from '@boh/renderer';
import { ABILITIES, abilityName, type Ability } from '@boh/rules';
import { cn } from '@boh/ui';
import { useEffect, useState, type ReactNode } from 'react';
import type { CharacterFile } from '../../../app/characters/model';
import { loadEntity } from '../../../app/data/entities';
import type { CharacterView } from '../../../app/data/protocol';
import { SchoolIcon } from '../../../app/lists/cells';
import { PortraitImage } from '../Portrait';
import { pickName } from '../steps';

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
const ORDINAL = (n: number) =>
  `${String(n)}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const title = (s: string) =>
  s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** Entities the sheet shows in full (spells, features, items, species), loaded once. */
function useEntities(keys: readonly string[]): Map<string, EntityDetail> {
  const [map, setMap] = useState(new Map<string, EntityDetail>());
  const id = [...new Set(keys)].sort().join('\n');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (id ? id.split('\n') : []).map(async (k) => {
        const e = (await loadEntity(k)) ?? (await loadEntity(k.replace(/^item:/, 'baseitem:')));
        return [k, e] as const;
      }),
    ).then((pairs) => {
      if (!cancelled)
        setMap(
          new Map(pairs.filter((p): p is readonly [string, EntityDetail] => p[1] !== undefined)),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return map;
}

export function PrintSheet({ character, view }: { character: CharacterFile; view: CharacterView }) {
  const sheet = view.sheet;
  const spellKeys = [...new Set(view.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : [])))];
  const featureKeys = view.features.filter((f) => !f.key.includes('#')).map((f) => f.key);
  const itemKeys = (character.decisions.inventory ?? []).map((i) => i.key).filter(Boolean);
  const speciesKeys = view.entities
    .filter((e) => e.type === 'race' || e.type === 'subrace')
    .map((e) => e.key);
  const entities = useEntities([...spellKeys, ...featureKeys, ...itemKeys, ...speciesKeys]);
  const nameOf = (key: string) => view.entities.find((e) => e.key === key)?.name;

  const classLine = view.classes
    .map((c) => {
      const sub = c.subclass ? nameOf(c.subclass) : undefined;
      return `${c.name}${sub ? ` (${sub})` : ''} ${String(c.levels)}`;
    })
    .join(' / ');
  const species = nameOf(character.decisions.species ?? '') ?? '';
  const background = nameOf(character.decisions.background ?? '') ?? '';
  const spells = spellKeys
    .map((k) => entities.get(k))
    .filter((e): e is EntityDetail => e !== undefined)
    .sort(
      (a, b) =>
        Number(a.data.level ?? 0) - Number(b.data.level ?? 0) || a.name.localeCompare(b.name, 'en'),
    );
  const caster = sheet.spellcasting[0];

  return (
    <div className="paper text-text">
      {/* Page 1: the main sheet. */}
      <Page>
        <div className="grid grid-cols-[38%_1fr] gap-3">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border-2 border-border-strong bg-surface p-1">
            {character.portrait ? (
              <PortraitImage character={character} size={260} className="h-full w-full" />
            ) : (
              <span className="text-sm text-faint">Portrait</span>
            )}
          </div>
          <div className="space-y-2">
            <Box title="Character">
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Character name" value={character.name} />
                <Field label="Class & level" value={classLine} />
                <Field label="Species" value={species} />
                <Field label="Background" value={background} />
              </div>
            </Box>
            <div className="grid grid-cols-[40%_1fr] gap-2">
              <Box title="Combat">
                <div className="grid grid-cols-2 gap-1.5">
                  <Stat label="AC" value={String(sheet.ac.value)} />
                  <Stat label="Init" value={signed(sheet.initiative.value)} />
                </div>
              </Box>
              <Box title="Hit points">
                <div className="grid grid-cols-3 gap-1.5">
                  <Stat label="Current HP" value="" />
                  <Stat label="Max HP" value={String(sheet.hp.value)} big />
                  <Stat label="Temp HP" value="" />
                </div>
              </Box>
            </div>
            <div className="grid grid-cols-[40%_1fr] gap-2">
              <Box title="Inspiration">
                <div className="mx-auto h-8 w-8 rounded border-2 border-border-strong" />
              </Box>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border p-1.5">
                <Stat
                  label="Hit dice"
                  value={sheet.hitDice
                    .map((h) => `${String(h.count)}d${String(h.faces)}`)
                    .join(' + ')}
                />
                <div className="rounded border border-border p-1 text-center text-[9px] font-semibold uppercase">
                  Death saves
                  <div className="mt-1 space-y-0.5">
                    <Bubbles count={3} label="✓" />
                    <Bubbles count={3} label="✗" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[40%_1fr] gap-2">
              <div className="space-y-2">
                {caster && (
                  <Box title="Spell DC">
                    <p className="text-center text-xl font-bold">{caster.dc.value}</p>
                  </Box>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Box title="PB">
                    <p className="text-center text-lg font-bold">
                      {signed(sheet.proficiencyBonus)}
                    </p>
                  </Box>
                  <Box title="Speed">
                    <p className="text-center text-lg font-bold">{sheet.speed.walk ?? 30} ft.</p>
                  </Box>
                </div>
              </div>
              <Box title="Proficiencies">
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
              </Box>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[38%_1fr] gap-3">
          <div className="grid grid-cols-[34%_1fr] gap-2">
            <div className="space-y-1.5">
              {ABILITIES.map((a) => {
                const line = sheet.abilities[a];
                return (
                  <div
                    key={a}
                    className="overflow-hidden rounded-md border-2 text-center"
                    style={{ borderColor: `var(--boh-${a})` }}
                  >
                    <p
                      className="py-0.5 text-[9px] font-bold text-white uppercase"
                      style={{ background: `var(--boh-${a})` }}
                    >
                      {ABBR[a]}
                    </p>
                    <p className="text-lg leading-tight font-bold">{line.score.value}</p>
                    <p className="text-xs">{signed(line.modifier)}</p>
                    <p
                      className={cn(
                        'border-t border-border text-[9px] text-muted',
                        line.save.proficient && 'font-bold text-text',
                      )}
                    >
                      Save {signed(line.save.value)}
                    </p>
                  </div>
                );
              })}
            </div>
            <Box title="Skills">
              <ul className="space-y-[3px] text-[10px]">
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
          <div className="space-y-2">
            <Box title="Senses">
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-xs">
                <dt>Perception</dt>
                <dd className="font-bold">{sheet.passive.perception.value}</dd>
                <dt>Insight</dt>
                <dd className="font-bold">{sheet.passive.insight.value}</dd>
                <dt>Investigation</dt>
                <dd className="font-bold">{sheet.passive.investigation.value}</dd>
              </dl>
              {Object.entries(sheet.senses).map(([k, v]) => (
                <p key={k} className="mt-1 text-xs">
                  {title(k)} {v} ft.
                </p>
              ))}
            </Box>
            <Box title="Attacks & cantrips">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase">
                    <th className="py-0.5 text-left">Name</th>
                    <th>Abi</th>
                    <th>Hit</th>
                    <th>Damage / type</th>
                    <th className="text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.attacks.map((atk) => {
                    const ability =
                      atk.save?.ability ?? atk.toHit?.parts[0]?.label.slice(0, 3).toLowerCase();
                    return (
                      <tr key={atk.key} className="border-t border-border">
                        <td className="py-1">{atk.name}</td>
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
                  {Array.from({ length: Math.max(0, 14 - sheet.attacks.length) }, (_, i) => (
                    <tr key={`empty-${String(i)}`} className="h-5 border-t border-border">
                      <td colSpan={5} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </div>
        </div>
      </Page>

      {/* Page 2: spellcasting. */}
      {caster && (
        <Page>
          <Box title="Spellcasting">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Spell abil." value={ABBR[caster.ability]} />
              <Stat label="Spell mod" value={signed(sheet.abilities[caster.ability].modifier)} />
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
                {spells.map((s) => {
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
      )}

      {/* Page 3: equipment. */}
      <Page>
        <Box title="Equipment">
          <p className="mb-2 text-sm">
            {(['pp', 'gp', 'ep', 'sp', 'cp'] as const)
              .map((k) => `${k.toUpperCase()}: ${String(character.coins[k] || '___')}`)
              .join('   ')}
          </p>
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
              {(character.decisions.inventory ?? []).map((it, i) => {
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
              {Array.from(
                { length: Math.max(0, 25 - (character.decisions.inventory ?? []).length) },
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

      {/* Page 4: features. */}
      <Page>
        <Box title="Features">
          <p className="mb-2 text-xs">
            {Object.entries(sheet.senses)
              .map(([k, v]) => `${title(k)} ${String(v)} ft.`)
              .join(', ')}
          </p>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[9px] text-muted uppercase">
                <th className="py-0.5 text-left">Source</th>
                <th className="text-left">Name</th>
                <th className="w-10">Lvl</th>
              </tr>
            </thead>
            <tbody>
              {view.features.map((f) => (
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

      {/* Page 5: personality and backstory. */}
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

      {/* Cards: spells by level, features and traits, items. */}
      <CardPages
        groups={[
          ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((lvl) => {
            const list = spells.filter((s) => (s.data.level ?? 0) === lvl);
            return list.length
              ? [
                  {
                    title: lvl === 0 ? 'Cantrips' : `${ORDINAL(lvl)}-level spells`,
                    cards: list.map((s) => (
                      <SpellCard key={s.key} spell={s} dc={caster?.dc.value} />
                    )),
                  },
                ]
              : [];
          }),
          {
            title: 'Features and traits',
            cards: view.features.flatMap((f) => {
              const text = featureText(f.key, f.name, entities);
              return text === undefined
                ? []
                : [
                    <Card
                      key={f.key}
                      title={f.name}
                      subtitle={`${sourceLabel(f.from, view)}${f.level ? ` — Level ${String(f.level)}` : ''}`}
                      accent="var(--boh-int)"
                    >
                      <Entries entries={text} />
                    </Card>,
                  ];
            }),
          },
          {
            title: 'Items',
            cards: (character.decisions.inventory ?? []).flatMap((it, i) => {
              const e = entities.get(it.key);
              return e
                ? [
                    <Card key={`${it.key}-${String(i)}`} title={e.name} accent="var(--boh-int)">
                      <EntityView type={e.type} data={e.data} edition={e.edition} />
                    </Card>,
                  ]
                : [];
            }),
          },
        ]}
      />
    </div>
  );
}

function sourceLabel(from: string, view: CharacterView): string {
  if (from.startsWith('race:') || from.startsWith('subrace:')) return 'Species';
  if (from.startsWith('background:')) return 'Background';
  if (from.startsWith('feat:')) return 'Feat';
  if (from.startsWith('optionalfeature:')) return 'Option';
  return view.entities.find((e) => e.key === from)?.name ?? '';
}

/** A feature's text: its entity's, or a species trait's from the species entries. */
function featureText(key: string, name: string, entities: Map<string, EntityDetail>): unknown {
  const hash = key.indexOf('#');
  if (hash < 0) return entities.get(key)?.data.entries;
  const species = entities.get(key.slice(0, hash));
  const entries = Array.isArray(species?.data.entries) ? (species.data.entries as unknown[]) : [];
  const entry = entries.find(
    (e) => typeof e === 'object' && e !== null && 'name' in e && e.name === name,
  );
  return typeof entry === 'object' && entry !== null && 'entries' in entry
    ? entry.entries
    : undefined;
}

const PROPERTIES: Record<string, string> = {
  L: 'light', F: 'finesse', T: 'thrown', V: 'versatile', H: 'heavy', '2H': 'two-handed', R: 'reach',
  A: 'ammunition', LD: 'loading',
}; // prettier-ignore
const propertyName = (p: string) => PROPERTIES[p] ?? p;

function Page({ children }: { children: ReactNode }) {
  return (
    <section className="sheet-page mx-auto mb-6 box-border min-h-[297mm] w-[210mm] bg-bg p-[8mm] shadow-card">
      {children}
    </section>
  );
}

function Box({ title: heading, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <h3 className="bg-header px-2 py-0.5 font-serif text-[11px] font-bold tracking-wide text-header-fg uppercase">
        {heading}
      </h3>
      <div className="p-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-1.5 py-1">
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex min-h-12 flex-col items-center justify-center rounded border border-border px-1 py-1 text-center">
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
    <span className="inline-flex items-center gap-0.5">
      {label && <span className="w-3 text-[10px]">{label}</span>}
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

function Card({
  title: heading,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <article
      className="mb-3 break-inside-avoid rounded-md border border-border border-l-4 bg-surface p-2.5 text-[11px] leading-snug"
      style={{ borderLeftColor: accent }}
    >
      <h4 className="font-serif text-sm font-bold">{heading}</h4>
      {subtitle && <p className="mb-1 text-[10px] text-muted">{subtitle}</p>}
      <div className="[&_p]:my-1">{children}</div>
    </article>
  );
}

function SpellCard({ spell, dc }: { spell: EntityDetail; dc: number | undefined }) {
  const d = spell.data;
  const lvl = typeof d.level === 'number' ? d.level : 0;
  const school = SCHOOLS[String(d.school)] ?? '';
  const save =
    Array.isArray(d.savingThrow) && typeof d.savingThrow[0] === 'string'
      ? d.savingThrow[0].slice(0, 3).toUpperCase()
      : undefined;
  return (
    <Card
      title={spell.name}
      subtitle={
        lvl === 0
          ? `${school.toLowerCase()} cantrip`
          : `${ORDINAL(lvl)}-level ${school.toLowerCase()}`
      }
      accent={`var(--boh-school-${school.toLowerCase()})`}
    >
      <dl className="grid grid-cols-2 gap-x-2 text-[10px]">
        <dd>{castingTime(d)}</dd>
        <dd>{spellRange(d)}</dd>
        <dd>{spellDuration(d)}</dd>
      </dl>
      {save && dc !== undefined && (
        <p className="text-[10px] font-bold">
          {save} save · DC {dc}
        </p>
      )}
      <Entries entries={d.entries} />
      {d.entriesHigherLevel !== undefined && <Entries entries={d.entriesHigherLevel} />}
    </Card>
  );
}

/** Card sections, flowing in two columns across as many pages as they need. */
function CardPages({ groups }: { groups: { title: string; cards: ReactNode[] }[] }) {
  const shown = groups.filter((g) => g.cards.length > 0);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((g) => (
        <section
          key={g.title}
          className="sheet-page mx-auto mb-6 box-border w-[210mm] bg-bg p-[8mm] shadow-card"
        >
          <h2 className="mb-3 border-b border-border pb-1 text-center font-serif text-sm font-bold tracking-widest uppercase">
            {g.title}
          </h2>
          <div className="columns-2 gap-3">{g.cards}</div>
        </section>
      ))}
    </>
  );
}
