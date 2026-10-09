import { ABILITIES, abilityName } from '@boh/rules';
import { cn } from '@boh/ui';
import { useEffect } from 'react';
import { AppLink } from '../AppLink';
import { entityPath } from '../data/entities';
import { RollChip } from '../dice/RollChip';
import { useCharacters } from './store';
import { useCharacterSheet } from './useCharacterSheet';
import { signed } from '../format';

/**
 * A character at a glance, for boards, encounters and the combat tracker: the numbers a DM asks
 * for (AC, hit points, passive Perception, saves), with the spells, features and inventory as
 * optional sections. Every number rolls.
 */

export interface CharacterCardShow {
  spells?: boolean;
  features?: boolean;
  inventory?: boolean;
}

const ABBR = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' } as const;
const nameOfKey = (key: string) =>
  (key.split(':')[1]?.split('@')[0] ?? key).replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase());

export function CharacterCard({
  characterId,
  show = {},
  className,
}: {
  characterId: string;
  show?: CharacterCardShow;
  className?: string;
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
  const roll = (bonus: number, label: string) => ({
    kind: 'd20' as const,
    expression: `1d20${signed(bonus)}`,
    label: `${character.name}: ${label}`,
  });
  const spells = view.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : []));
  const skills = Object.entries(s.skills).filter(([, l]) => l.proficiency > 0);
  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <div>
        <p className="font-serif text-base font-bold">
          <AppLink to={`/characters/${character.id}?step=sheet`} className="hover:underline">
            {character.name}
          </AppLink>
        </p>
        <p className="text-xs text-muted">{character.summary}</p>
      </div>
      <dl className="grid grid-cols-5 gap-1 text-center">
        {(
          [
            ['AC', String(s.ac.value)],
            ['HP', String(s.hp.value)],
            ['Init', signed(s.initiative.value)],
            ['Speed', `${String(s.speed.walk ?? 30)} ft`],
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
              <p className="text-[10px] text-muted">
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
      {skills.length > 0 && (
        <p className="text-xs">
          <span className="font-semibold">Skills: </span>
          {skills.map(([name, line], i) => (
            <span key={name}>
              {i > 0 && ', '}
              <span className="capitalize">{name}</span>{' '}
              <RollChip plain roll={roll(line.value, name)}>
                {signed(line.value)}
              </RollChip>
            </span>
          ))}
        </p>
      )}
      {s.attacks.length > 0 && (
        <ul aria-label={`${character.name} attacks`} className="space-y-0.5 text-xs">
          {s.attacks.map((a) => (
            <li key={a.key + a.name} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">{a.name}</span>
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
                    expression: a.damage,
                    label: `${character.name}: ${a.name}`,
                  }}
                >
                  {a.damage}
                </RollChip>
              )}
            </li>
          ))}
        </ul>
      )}
      {show.spells && spells.length > 0 && (
        <section aria-label="Spells">
          <h4 className="text-xs font-semibold text-muted uppercase">Spells</h4>
          {s.spellcasting.map((c) => (
            <p key={c.from} className="text-xs text-muted">
              {c.name}: save DC {c.dc.value}, attack {signed(c.attack.value)}
            </p>
          ))}
          <p className="text-xs">
            {spells.map((k, i) => (
              <span key={k}>
                {i > 0 && ', '}
                <AppLink to={entityPath(k)} className="text-link hover:underline">
                  {nameOfKey(k)}
                </AppLink>
              </span>
            ))}
          </p>
        </section>
      )}
      {show.features && view.features.length > 0 && (
        <section aria-label="Features">
          <h4 className="text-xs font-semibold text-muted uppercase">Features</h4>
          <p className="text-xs">{view.features.map((f) => f.name).join(', ')}</p>
        </section>
      )}
      {show.inventory && (character.decisions.inventory ?? []).length > 0 && (
        <section aria-label="Inventory">
          <h4 className="text-xs font-semibold text-muted uppercase">Inventory</h4>
          <p className="text-xs">
            {(character.decisions.inventory ?? [])
              .map(
                (it) =>
                  `${it.quantity > 1 ? `${String(it.quantity)} × ` : ''}${it.name ?? nameOfKey(it.key)}`,
              )
              .join(', ')}
          </p>
        </section>
      )}
    </div>
  );
}
