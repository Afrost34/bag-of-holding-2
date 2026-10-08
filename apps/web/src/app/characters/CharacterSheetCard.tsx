import type { RollSpec } from '@boh/renderer';
import { ABILITIES, abilityName } from '@boh/rules';
import { cn } from '@boh/ui';
import { useContext, useEffect, type MouseEvent, type ReactNode } from 'react';
import { AppLink } from '../AppLink';
import { entityPath } from '../data/entities';
import { RollChip } from '../dice/RollChip';
import { wantsNewTab } from '../navigation';
import { EntityLinkClickContext } from '../renderer/linkClick';
import { useCharacters } from './store';
import { useCharacterSheet } from './useCharacterSheet';

/**
 * A character as the first page of its sheet, for a board: the numbers, abilities and saves,
 * every skill, attacks, proficiencies and defences. Spells, features, inventory and the story are
 * sections the DM opens from the card's side. Every number rolls.
 */

export interface SheetSections {
  spells?: boolean;
  features?: boolean;
  inventory?: boolean;
  story?: boolean;
}

const ABBR = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' } as const;
const signed = (n: number) => (n >= 0 ? `+${String(n)}` : String(n));
const titled = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase());
const nameOfKey = (key: string) => titled(key.split(':')[1]?.split('@')[0]?.split('|')[0] ?? key);

/** A link to an entry; on a board, a plain click brings it onto the board instead. */
function EntryLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const pick = useContext(EntityLinkClickContext);
  return (
    <AppLink
      to={entityPath(to)}
      onClick={(e: MouseEvent) => {
        if (pick && !wantsNewTab(e)) {
          e.preventDefault();
          pick(to);
        }
      }}
      className={cn('text-link hover:underline', className)}
    >
      {children}
    </AppLink>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-t border-border pt-2">
      <h4 className="mb-1 font-serif text-xs font-bold tracking-wide text-accent-ink uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function CharacterSheetCard({
  characterId,
  show = {},
}: {
  characterId: string;
  show?: SheetSections;
}) {
  const { loaded, load } = useCharacters();
  const character = useCharacters((s) => s.characters.find((c) => c.id === characterId));
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const view = useCharacterSheet(character?.decisions, character?.preferences.feats ?? true);
  if (!character) return <p className="text-muted">This character is not here any more.</p>;
  if (!view) return <p className="text-muted">Reading {character.name}…</p>;
  const s = view.sheet;
  const roll = (bonus: number, label: string): RollSpec => ({
    kind: 'd20',
    expression: `1d20${signed(bonus)}`,
    label: `${character.name}: ${label}`,
  });
  const spells = view.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : []));
  const slots = s.slots.slice(1);
  const details = character.details;
  const story = (
    [
      ['Personality', details.personality],
      ['Ideals', details.ideals],
      ['Bonds', details.bonds],
      ['Flaws', details.flaws],
      ['Backstory', details.backstory],
    ] as const
  ).filter(([, v]) => v);
  const prof = s.proficiencies;
  const proficiencyRows = (
    [
      ['Armor', prof.armor],
      ['Weapons', prof.weapons.map((w) => (w.includes(':') ? nameOfKey(w) : w))],
      ['Tools', prof.tools.map((t) => t.split('|')[0] ?? t)],
      ['Languages', prof.languages],
      ['Senses', Object.entries(s.senses).map(([k, v]) => `${k} ${String(v)} ft.`)],
      ['Resistances', s.defences.resist],
      ['Immunities', [...s.defences.immune, ...s.defences.conditionImmune]],
    ] as const
  ).filter(([, items]) => items.length > 0);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate font-serif text-base font-bold">
          <AppLink to={`/characters/${character.id}?step=sheet`} className="hover:underline">
            {character.name}
          </AppLink>
        </p>
        <p className="truncate text-xs text-muted">{character.summary}</p>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-center sm:grid-cols-6">
        {(
          [
            ['AC', String(s.ac.value)],
            ['HP', String(s.hp.value)],
            ['Init', signed(s.initiative.value)],
            [
              'Speed',
              `${String(s.speed.walk ?? 30)}${s.speed.fly ? `/${String(s.speed.fly)}f` : ''}`,
            ],
            ['Prof', signed(s.proficiencyBonus)],
            ['Passive', String(s.passive.perception.value)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded border border-border px-1 py-1">
            <dt className="text-[10px] font-semibold text-muted uppercase">{label}</dt>
            <dd className="font-bold">
              {label === 'Init' ? (
                <RollChip plain roll={roll(s.initiative.value, 'initiative')}>
                  {value}
                </RollChip>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map((a) => {
          const line = s.abilities[a];
          return (
            <div key={a} className="rounded border border-border px-0.5 py-1">
              <p className="text-[10px] font-semibold text-muted">{ABBR[a]}</p>
              <RollChip plain roll={roll(line.check.value, `${abilityName(a)} check`)}>
                <span className="font-bold">{signed(line.modifier)}</span>
              </RollChip>
              <p className="text-[10px] text-muted">{line.score.value}</p>
              <p className="border-t border-border text-[10px] text-muted">
                Save{' '}
                <RollChip plain roll={roll(line.save.value, `${abilityName(a)} save`)}>
                  <span className={cn(line.save.proficient && 'font-bold text-text')}>
                    {signed(line.save.value)}
                  </span>
                </RollChip>
              </p>
            </div>
          );
        })}
      </div>

      <Section title="Skills">
        <ul className="grid grid-cols-2 gap-x-3 text-xs">
          {Object.entries(s.skills).map(([name, line]) => (
            <li key={name} className="flex items-center gap-1.5 py-px">
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full border border-text',
                  line.proficiency >= 1 && 'bg-text',
                  line.proficiency === 2 && 'ring-2 ring-accent',
                )}
              />
              <span className={cn('flex-1 truncate', line.proficiency > 0 && 'font-semibold')}>
                {titled(name)}
              </span>
              <RollChip plain roll={roll(line.value, titled(name))}>
                {signed(line.value)}
              </RollChip>
            </li>
          ))}
        </ul>
      </Section>

      {s.attacks.length > 0 && (
        <Section title="Attacks">
          <ul aria-label={`${character.name} attacks`} className="space-y-0.5 text-xs">
            {s.attacks.map((a) => (
              <li key={a.key + a.name} className="flex flex-wrap items-baseline gap-x-2">
                <EntryLink to={a.key} className="flex-1 font-semibold text-text">
                  {a.name}
                </EntryLink>
                {a.toHit && (
                  <RollChip plain roll={roll(a.toHit.value, a.name)}>
                    {signed(a.toHit.value)}
                  </RollChip>
                )}
                {a.save && (
                  <span>
                    DC {a.save.dc.value} {ABBR[a.save.ability]}
                  </span>
                )}
                {a.damage && (
                  <RollChip
                    plain
                    roll={{
                      kind: 'damage',
                      expression: a.damage.split(' ')[0] ?? a.damage,
                      label: `${character.name}: ${a.name}`,
                    }}
                  >
                    {a.damage}
                  </RollChip>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {proficiencyRows.length > 0 && (
        <Section title="Proficiencies">
          <dl className="space-y-0.5 text-xs">
            {proficiencyRows.map(([label, items]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-20 shrink-0 font-semibold text-muted">{label}</dt>
                <dd className="min-w-0 capitalize">{items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {show.spells && (spells.length > 0 || s.spellcasting.length > 0) && (
        <Section title="Spells">
          {s.spellcasting.map((c) => (
            <p key={c.from} className="text-xs text-muted">
              {c.name}: save DC {c.dc.value}, attack{' '}
              <RollChip plain roll={roll(c.attack.value, 'spell attack')}>
                {signed(c.attack.value)}
              </RollChip>
            </p>
          ))}
          {(slots.length > 0 || s.pact) && (
            <p className="text-xs text-muted">
              Slots: {slots.map((n, i) => `${String(i + 1)}: ${String(n)}`).join(' · ')}
              {s.pact && `Pact: ${String(s.pact.slots)} of level ${String(s.pact.level)}`}
            </p>
          )}
          <ul className="mt-1 flex flex-wrap gap-1">
            {[...new Set(spells)].map((k) => (
              <li key={k}>
                <EntryLink
                  to={k}
                  className="inline-block rounded-full border border-border px-1.5 text-xs text-text no-underline hover:border-accent"
                >
                  {nameOfKey(k)}
                </EntryLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {show.features && view.features.length > 0 && (
        <Section title="Features">
          <ul className="flex flex-wrap gap-1">
            {view.features.map((f) => (
              <li key={f.key}>
                {f.key.includes('#') ? (
                  <span className="inline-block rounded-full border border-border px-1.5 text-xs">
                    {f.name}
                  </span>
                ) : (
                  <EntryLink
                    to={f.key}
                    className="inline-block rounded-full border border-border px-1.5 text-xs text-text no-underline hover:border-accent"
                  >
                    {f.name}
                  </EntryLink>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {show.inventory && (
        <Section title="Inventory">
          {(character.decisions.inventory ?? []).length === 0 ? (
            <p className="text-xs text-muted">Nothing carried.</p>
          ) : (
            <ul className="space-y-px text-xs">
              {(character.decisions.inventory ?? []).map((it, i) => (
                <li key={`${it.key}#${String(i)}`} className="flex gap-1.5">
                  {it.quantity > 1 && <span className="text-muted">{it.quantity} ×</span>}
                  <EntryLink to={it.key} className="text-text">
                    {it.name ?? nameOfKey(it.key)}
                  </EntryLink>
                  {it.equipped && <span className="text-muted">(equipped)</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {show.story && (
        <Section title="Story">
          {story.length === 0 ? (
            <p className="text-xs text-muted">No personality or backstory written yet.</p>
          ) : (
            <dl className="space-y-1.5 text-xs">
              {story.map(([label, text]) => (
                <div key={label}>
                  <dt className="font-semibold text-muted">{label}</dt>
                  <dd className="whitespace-pre-line">{text}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      )}
    </div>
  );
}
