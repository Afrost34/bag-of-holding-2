import { components } from '@boh/data5e/format';
import { ABILITIES, abilityName, type Ability } from '@boh/rules';
import { cn } from '@boh/ui';
import {
  Brain,
  Check,
  Dumbbell,
  Eye,
  Heart,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { CharacterFile } from '../../../app/characters/model';
import { PackedPages } from '../../../app/cards/PackedPages';
import type { CharacterView } from '../../../app/data/protocol';
import { signed, titleWords as title } from '../../../app/format';
import { SchoolIcon } from '../../../app/lists/cells';
import { PortraitImage } from '../../../app/characters/PortraitImage';
import { pickName } from '../steps';
import { ArrangedCard, HiddenCardsPage, type CardArranging } from './CardArrange';
import { ORDINAL, pageRows, shortCast, shortRange, sourceLabel } from './printText';
import type { PrintSection } from './sections';
import type { PrintData } from './usePrintData';

/**
 * The character sheet on paper, in the layout of the owner's earlier app: a main page (portrait,
 * identity, combat, hit points, abilities, skills, senses, proficiencies, attacks), then
 * spellcasting, equipment, features, personality and backstory, then cards for every spell,
 * feature and item. Each `.sheet-page` is an A4 page; the whole thing is light, whatever the app
 * theme (`.paper`). Tables run on with empty lines to write in.
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
const ABILITY_ICONS: Record<Ability, LucideIcon> = {
  str: Dumbbell,
  dex: Target,
  con: Heart,
  int: Brain,
  wis: Eye,
  cha: Sparkles,
};
const PROPERTIES: Record<string, string> = {
  L: 'light', F: 'finesse', T: 'thrown', V: 'versatile', H: 'heavy', '2H': 'two-handed', R: 'reach',
  A: 'ammunition', LD: 'loading',
}; // prettier-ignore
const propertyName = (p: string) => PROPERTIES[p] ?? p;
const isAbility = (v: unknown): v is Ability => typeof v === 'string' && v in ABBR;

/** Rows per page of the long tables (the first page of each has a header above the table). */
const SPELL_ROWS = [34, 40] as const;
const ITEM_ROWS = [36, 40] as const;
const FEATURE_ROWS = [38, 40] as const;
/** Lines of the attacks table, written-in ones included. */
const ATTACK_ROWS = 12;

export function PrintSheet({
  character,
  view,
  data,
  hidden = [],
  arranging,
}: {
  character: CharacterFile;
  view: CharacterView;
  data: PrintData;
  /** Parts left out. */
  hidden?: readonly PrintSection[];
  /** On screen only: the cards can be moved, left out and rewritten where they are. */
  arranging?: CardArranging;
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
  const prof = sheet.proficiencies;

  return (
    <div className="paper text-text">
      {/* Page 1: the main sheet. */}
      {shown('main') && (
        <Page>
          <div className="flex h-full gap-2">
            {/* Left: the portrait, then abilities beside skills. */}
            <div className="flex w-[41%] flex-col gap-2">
              <div className="h-[104mm] shrink-0 rounded-lg border border-border-strong bg-surface-2 p-1.5">
                <div className="flex h-full items-center justify-center overflow-hidden rounded-md border border-border bg-sunken">
                  {character.portrait ? (
                    <PortraitImage character={character} size={420} className="h-full w-full" />
                  ) : (
                    <span className="text-sm text-faint">Portrait</span>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 gap-2">
                <div className="flex w-[21%] flex-col justify-between">
                  {ABILITIES.map((a) => (
                    <AbilityBox
                      key={a}
                      ability={a}
                      line={sheet.abilities[a]}
                      display={character.preferences.abilityDisplay}
                    />
                  ))}
                </div>
                <Box title="Skills" className="flex-1" bodyClass="p-0">
                  <ul className="flex h-full flex-col text-[10.5px]">
                    {Object.entries(sheet.skills).map(([skill, line], i) => (
                      <li
                        key={skill}
                        className={cn(
                          'flex flex-1 items-center gap-1.5 px-1.5',
                          i % 2 === 1 && 'bg-sunken',
                        )}
                      >
                        <ProfDot level={line.proficiency} />
                        <span className="w-6 text-right font-bold">{signed(line.value)}</span>
                        <span className="flex-1 truncate">
                          {title(skill).replace(/ (Of|And) /, (m) => m.toLowerCase())}
                        </span>
                        <AbilityBadge ability={line.ability} />
                      </li>
                    ))}
                  </ul>
                </Box>
              </div>
            </div>

            {/* Right: identity, then two columns, then attacks to the foot of the page. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Box title="Character" bodyClass="grid grid-cols-2 gap-1.5">
                <Field label="Character name" value={character.name} />
                <Field label="Class & level" value={classLine} />
                <Field label="Species" value={species} />
                <Field label="Background" value={background} />
              </Box>
              <div className="flex gap-2">
                <div className="flex w-[33%] flex-col gap-2">
                  <Box title="Combat" bodyClass="grid grid-cols-2 gap-1.5">
                    <StatBox value={String(sheet.ac.value)} label="AC" />
                    <StatBox
                      value={signed(sheet.initiative.value)}
                      label="Init"
                      badge={<AbilityBadge ability="dex" />}
                    />
                  </Box>
                  <Box title="Inspiration" bodyClass="flex justify-center py-1.5">
                    <span className="h-7 w-7 rounded border-2 border-border-strong bg-surface" />
                  </Box>
                  {caster ? (
                    <Box title="Spell DC" bodyClass="text-center text-lg font-bold">
                      {caster.dc.value}
                    </Box>
                  ) : (
                    <Box title="Passive perc." bodyClass="text-center text-lg font-bold">
                      {sheet.passive.perception.value}
                    </Box>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Box title="PB" bodyClass="text-center text-lg font-bold">
                      {signed(sheet.proficiencyBonus)}
                    </Box>
                    <Box title="Speed" bodyClass="text-center text-lg font-bold">
                      {sheet.speed.walk ?? 30} ft.
                    </Box>
                  </div>
                  <Box title="Senses" className="flex-1" bodyClass="space-y-1 text-[11px]">
                    <SenseLine label="Perception" value={sheet.passive.perception.value} />
                    <SenseLine label="Insight" value={sheet.passive.insight.value} />
                    <SenseLine label="Investigation" value={sheet.passive.investigation.value} />
                    {Object.entries(sheet.senses).map(([k, v]) => (
                      <SenseLine key={k} label={title(k)} value={`${String(v)} ft.`} />
                    ))}
                  </Box>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Box title="Hit points" bodyClass="space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <WriteBox label="Current HP" />
                      <WriteBox label="Max HP" value={String(sheet.hp.value)} />
                      <WriteBox label="Temp HP" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-md border border-border bg-surface px-1 py-1 text-center">
                        <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">
                          Hit dice
                        </p>
                        <p className="text-sm font-bold">
                          {sheet.hitDice
                            .map((h) => `${String(h.count)}d${String(h.faces)}`)
                            .join(' + ')}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-1 py-1 text-center">
                        <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">
                          Death saves
                        </p>
                        <DeathSaves />
                      </div>
                    </div>
                  </Box>
                  <Box title="Proficiencies" className="flex-1" bodyClass="space-y-1">
                    <ProfSection
                      label="Armor"
                      items={prof.armor.map((a) =>
                        `${title(a)} Armor`.replace('Shield Armor', 'Shields'),
                      )}
                    />
                    <ProfSection
                      label="Weapons"
                      shaded
                      items={prof.weapons.map((w) =>
                        w.includes(':') ? pickName(w) : `${title(w)} Weapons`,
                      )}
                    />
                    <ProfSection label="Tools" items={prof.tools.map(title)} />
                    <ProfSection label="Languages" shaded items={prof.languages.map(title)} />
                  </Box>
                </div>
              </div>
              <Box title="Attacks & cantrips" className="min-h-0 flex-1" bodyClass="h-full">
                <Grid
                  columns={['Name', 'Abi', 'Hit', 'Damage/type', 'Range', 'Notes']}
                  widths={['22%', '10%', '10%', '20%', '14%', '24%']}
                  center={[1, 2, 4]}
                  rows={sheet.attacks.map((atk) => {
                    const ability =
                      atk.save?.ability ?? atk.toHit?.parts[0]?.label.slice(0, 3).toLowerCase();
                    return [
                      atk.name,
                      isAbility(ability) ? <AbilityBadge ability={ability} /> : '',
                      atk.toHit
                        ? signed(atk.toHit.value)
                        : atk.save
                          ? `DC ${String(atk.save.dc.value)}`
                          : '',
                      atk.damage ?? '',
                      atk.range ?? '',
                      atk.save
                        ? `${ABBR[atk.save.ability]} save`
                        : atk.properties.map(propertyName).join(', '),
                    ];
                  })}
                  lines={ATTACK_ROWS}
                />
              </Box>
            </div>
          </div>
        </Page>
      )}

      {/* Spellcasting. */}
      {caster &&
        shown('spellcasting') &&
        pageRows(spells, SPELL_ROWS[0], SPELL_ROWS[1]).map((part, page, all) => (
          <Page key={`spells-${String(page)}`}>
            <Box
              title={page === 0 ? 'Spellcasting' : 'Spellcasting (continued)'}
              className="h-full"
              bodyClass="space-y-2"
            >
              {page === 0 && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox value={ABBR[caster.ability]} label="Spell abil." />
                    <StatBox
                      value={signed(sheet.abilities[caster.ability].modifier)}
                      label="Spell mod"
                    />
                    <StatBox value={String(caster.dc.value)} label="Spell DC" />
                    <StatBox value={signed(caster.attack.value)} label="Spell atk" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sheet.slots
                      .slice(1)
                      .map((n, i) =>
                        n > 0 ? <SlotPill key={i} label={ORDINAL(i + 1)} count={n} /> : null,
                      )}
                    {sheet.pact && (
                      <SlotPill
                        label={`Pact (${ORDINAL(sheet.pact.level)})`}
                        count={sheet.pact.slots}
                      />
                    )}
                  </div>
                </>
              )}
              <Grid
                columns={['Lvl', 'Icon', 'Name', 'Comp', 'Cast', 'Range', 'C', 'R']}
                widths={['7%', '7%', '27%', '10%', '17%', '18%', '7%', '7%']}
                center={[0, 1, 3, 4, 5, 6, 7]}
                rows={part.map((s) => {
                  const d = s.data;
                  const lvl = typeof d.level === 'number' ? d.level : 0;
                  const conc =
                    Array.isArray(d.duration) &&
                    d.duration.some(
                      (x: unknown) => typeof x === 'object' && x !== null && 'concentration' in x,
                    );
                  const ritual =
                    typeof d.meta === 'object' && d.meta !== null && 'ritual' in d.meta;
                  return [
                    <strong key="l" className={cn(lvl === 0 && 'italic')}>
                      {lvl === 0 ? 'C' : lvl}
                    </strong>,
                    <span key="i" className="flex justify-center">
                      <SchoolIcon small school={SCHOOLS[String(d.school)] ?? ''} />
                    </span>,
                    <span key="n" className={cn(lvl === 0 && 'italic')}>
                      {s.name}
                    </span>,
                    components(d)
                      .replace(/ \(.*$/, '')
                      .replace(/, /g, ','),
                    shortCast(d),
                    shortRange(d),
                    conc ? '•' : '',
                    ritual ? '•' : '',
                  ];
                })}
                lines={page === all.length - 1 ? (page === 0 ? SPELL_ROWS[0] : SPELL_ROWS[1]) : 0}
              />
            </Box>
          </Page>
        ))}

      {/* Equipment. */}
      {shown('equipment') &&
        pageRows(character.decisions.inventory ?? [], ITEM_ROWS[0], ITEM_ROWS[1]).map(
          (part, page, all) => (
            <Page key={`equipment-${String(page)}`}>
              <Box
                title={page === 0 ? 'Equipment' : 'Equipment (continued)'}
                className="h-full"
                bodyClass="space-y-2"
              >
                {page === 0 && (
                  <p className="text-base">
                    {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
                      <span key={k} className="mr-5">
                        {k.toUpperCase()}:{' '}
                        <span className="inline-block min-w-8 border-b border-text text-center">
                          {character.coins[k] || ''}
                        </span>
                      </span>
                    ))}
                  </p>
                )}
                <Grid
                  columns={['Qty', 'Item', 'Wt.', 'Notes']}
                  widths={['10%', '34%', '16%', '40%']}
                  center={[0, 2]}
                  rows={part.map((it) => {
                    const e = entities.get(it.key);
                    return [
                      it.quantity,
                      it.name ?? e?.name ?? pickName(it.key),
                      typeof e?.data.weight === 'number' ? `${String(e.data.weight)} lb` : '',
                      [it.equipped ? 'Equipped' : '', it.attuned ? 'Attuned' : '']
                        .filter(Boolean)
                        .join(', ') || '—',
                    ];
                  })}
                  lines={page === all.length - 1 ? (page === 0 ? ITEM_ROWS[0] : ITEM_ROWS[1]) : 0}
                />
              </Box>
            </Page>
          ),
        )}

      {/* Features. */}
      {shown('features') &&
        pageRows(data.features, FEATURE_ROWS[0], FEATURE_ROWS[1]).map((part, page, all) => (
          <Page key={`features-${String(page)}`}>
            <Box
              title={page === 0 ? 'Features' : 'Features (continued)'}
              className="h-full"
              bodyClass="space-y-2"
            >
              <Grid
                columns={['Source', 'Name', 'Lvl']}
                widths={['48%', '38%', '14%']}
                center={[2]}
                stripes={part.map((f) => sourceColor(f.from))}
                rows={part.map((f) => [
                  <strong key="s">{sourceLabel(f.from, view)}</strong>,
                  f.name,
                  <strong key="l">{f.level ?? '—'}</strong>,
                ])}
                lines={
                  page === all.length - 1 ? (page === 0 ? FEATURE_ROWS[0] : FEATURE_ROWS[1]) : 0
                }
              />
            </Box>
          </Page>
        ))}

      {/* Personality and backstory. */}
      {shown('story') && (
        <Page>
          <div className="flex h-full flex-col gap-3">
            <Box title="Personality" bodyClass="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {(
                [
                  ['Personality traits', character.details.personality],
                  ['Ideals', character.details.ideals],
                  ['Bonds', character.details.bonds],
                  ['Flaws', character.details.flaws],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <p className="mb-0.5 text-[9px] font-bold tracking-wide text-muted uppercase">
                    {label}
                  </p>
                  <p className="h-[26mm] overflow-hidden rounded-md border border-border bg-surface px-3 py-2 text-[11px] whitespace-pre-wrap">
                    {text ?? ''}
                  </p>
                </div>
              ))}
            </Box>
            <Box title="Backstory" className="min-h-0 flex-1" bodyClass="h-full">
              <p className="h-full overflow-hidden rounded-md border border-border bg-surface px-3 py-2 text-justify text-[11px] leading-relaxed whitespace-pre-wrap">
                {character.details.backstory ?? ''}
              </p>
            </Box>
          </div>
        </Page>
      )}

      {/* Cards: spells by level, features and traits, items, packed into A4 pages. */}
      <PackedPages
        packing={data.packing}
        items={data.cards}
        label="Cards page"
        {...(arranging
          ? {
              decorate: (id: string, node: ReactNode) => {
                const place = data.cardInfo.get(id);
                return place ? (
                  <ArrangedCard place={place} arranging={arranging}>
                    {node}
                  </ArrangedCard>
                ) : (
                  node
                );
              },
            }
          : {})}
      />
      {arranging && <HiddenCardsPage cards={data.hiddenCards} arranging={arranging} />}
    </div>
  );
}

/** Species purple, background slate, feats orange, class and subclass features cyan. */
function sourceColor(from: string): string {
  if (/^(race|subrace):/.test(from)) return 'var(--boh-wis)';
  if (from.startsWith('background:')) return 'var(--boh-text-muted)';
  if (from.startsWith('feat:')) return 'var(--boh-con)';
  return 'var(--boh-int)';
}

/** One A4 page: exactly 210 × 297 mm on screen and on paper; what does not fit is cut. */
function Page({ children }: { children: ReactNode }) {
  return (
    <section className="sheet-page mx-auto mb-6 box-border h-[297mm] w-[210mm] overflow-hidden bg-surface px-[8mm] py-[16mm] shadow-card">
      {children}
    </section>
  );
}

/** A panel with a dark title bar, as on the earlier app's sheet. */
function Box({
  title: heading,
  className,
  bodyClass,
  children,
}: {
  title: string;
  className?: string;
  bodyClass?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border-strong bg-surface-2',
        className,
      )}
    >
      <h3 className="bg-header px-2 py-0.5 font-serif text-[12px] font-bold tracking-wide text-header-fg uppercase">
        {heading}
      </h3>
      <div className={cn('min-h-0 flex-1 p-1.5', bodyClass)}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-1.5 py-1">
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="min-h-5 text-[13px] leading-tight font-semibold">{value}</p>
    </div>
  );
}

/** A number with its label below it. */
function StatBox({ value, label, badge }: { value: string; label: string; badge?: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-col items-center justify-center rounded-md border border-border bg-surface px-1 py-1 text-center">
      <p className="text-lg leading-tight font-bold">{value}</p>
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      {badge}
    </div>
  );
}

/** A box written in by hand: its label at the top, room below. */
function WriteBox({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex h-[21mm] flex-col rounded-md border border-border bg-surface px-1 py-1">
      <p className="text-[8px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      {value && (
        <p className="flex flex-1 items-center justify-center text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}

function SenseLine({ label, value }: { label: string; value: number | string }) {
  return (
    <p className="flex justify-between gap-2">
      <span className="font-medium text-muted">{label}</span>
      <strong className="text-[12px]">{value}</strong>
    </p>
  );
}

function ProfSection({
  label,
  items,
  shaded = false,
}: {
  label: string;
  items: string[];
  shaded?: boolean;
}) {
  return (
    <div className={cn('rounded px-1.5 py-1', shaded && 'bg-sunken')}>
      <p className="text-[11px] font-bold tracking-wide uppercase">{label}</p>
      <p className="text-[10.5px]">{items.join(', ') || '—'}</p>
    </div>
  );
}

function AbilityBox({
  ability,
  line,
  display,
}: {
  ability: Ability;
  line: CharacterView['sheet']['abilities'][Ability];
  /** Which the box shows large, as the character's sheet setting says. */
  display: 'modifiers' | 'scores';
}) {
  const Icon = ABILITY_ICONS[ability];
  const big = display === 'scores' ? String(line.score.value) : signed(line.modifier);
  const small = display === 'scores' ? signed(line.modifier) : String(line.score.value);
  return (
    <div
      className="overflow-hidden rounded-md border-2 bg-surface text-center"
      style={{ borderColor: `var(--boh-${ability})` }}
    >
      <p
        className="flex items-center justify-center gap-0.5 py-px text-[9px] font-bold text-white uppercase"
        style={{ background: `var(--boh-${ability})` }}
      >
        <Icon className="h-2.5 w-2.5" aria-hidden /> {ABBR[ability]}
      </p>
      <p className="text-lg leading-tight font-bold">{big}</p>
      <p className="text-[10px] text-muted">
        {small}
        {/* An item adding to checks (Stone of Good Luck): the check, beside the modifier. */}
        {line.check.value !== line.modifier && ` · check ${signed(line.check.value)}`}
      </p>
      <p
        className={cn(
          'border-t border-border py-px text-[8px] text-muted',
          line.save.proficient && 'font-bold text-text',
        )}
      >
        Save {signed(line.save.value)}
      </p>
    </div>
  );
}

function AbilityBadge({ ability }: { ability: Ability }) {
  const Icon = ABILITY_ICONS[ability];
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 text-[8px] leading-[13px] font-bold text-white"
      style={{ background: `var(--boh-${ability})` }}
      title={abilityName(ability)}
    >
      <Icon className="h-2 w-2" aria-hidden />
      {ABBR[ability]}
    </span>
  );
}

function ProfDot({ level }: { level: 0 | 0.5 | 1 | 2 }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full border',
        level === 2 && 'ring-1 ring-offset-1',
      )}
      style={{
        borderColor: level > 0 ? 'var(--boh-paper-mark)' : 'var(--boh-border-strong)',
        background:
          level >= 1
            ? 'var(--boh-paper-mark)'
            : level === 0.5
              ? 'linear-gradient(to right, var(--boh-paper-mark) 50%, transparent 50%)'
              : 'transparent',
        ...(level === 2 ? { ['--tw-ring-color' as string]: 'var(--boh-paper-mark)' } : {}),
      }}
    />
  );
}

function Ring() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2"
      style={{ borderColor: 'var(--boh-paper-mark)' }}
    />
  );
}

function SlotPill({ label, count }: { label: string; count: number }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-[12px] font-bold"
      style={{ borderColor: 'var(--boh-paper-mark)', color: 'var(--boh-paper-mark)' }}
    >
      {label}
      {Array.from({ length: count }, (_, i) => (
        <Ring key={i} />
      ))}
    </span>
  );
}

function DeathSaves() {
  const row = (Icon: LucideIcon, color: string) => (
    <span className="flex items-center justify-center gap-1">
      <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden />
      {[0, 1, 2].map((i) => (
        <span key={i} className="inline-block h-3 w-3 rounded-full border border-text" />
      ))}
    </span>
  );
  return (
    <div className="space-y-0.5">
      {row(Check, 'var(--boh-dex)')}
      {row(X, 'var(--boh-str)')}
    </div>
  );
}

/**
 * A table as on the earlier sheet: a light header, striped rows with cell borders, and empty
 * rows up to `lines` to write in. `stripes` colours the left edge of each filled row.
 */
function Grid({
  columns,
  widths,
  rows,
  lines,
  center = [],
  stripes,
}: {
  columns: string[];
  widths: string[];
  rows: ReactNode[][];
  lines: number;
  /** Columns centred, heading and cells (by index). */
  center?: readonly number[];
  stripes?: string[];
}) {
  const empty = Math.max(0, lines - rows.length);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full table-fixed border-collapse text-[10px]">
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-surface-2 text-[8.5px] tracking-wide text-muted uppercase">
            {columns.map((c, i) => (
              <th
                key={c}
                className={cn(
                  'border-b border-border px-1.5 py-1 font-semibold',
                  i > 0 && 'border-l',
                  center.includes(i) ? 'text-center' : 'text-left',
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className={cn('h-[6mm]', r % 2 === 1 && 'bg-sunken')}>
              {cells.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    'border-b border-border px-1.5 py-0.5 leading-tight',
                    i > 0 && 'border-l',
                    center.includes(i) && 'text-center',
                    i === 0 && stripes?.[r] && 'border-l-4',
                  )}
                  style={i === 0 && stripes?.[r] ? { borderLeftColor: stripes[r] } : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: empty }, (_, r) => (
            <tr
              key={`empty-${String(r)}`}
              className={cn('h-[6mm]', (rows.length + r) % 2 === 1 && 'bg-sunken')}
            >
              {columns.map((c, i) => (
                <td key={c} className={cn('border-b border-border', i > 0 && 'border-l')} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
