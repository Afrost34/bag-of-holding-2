import { tagDice } from './text';

/**
 * Statblock text as people write it ↔ 5etools tags. "Melee Attack Roll: +4, reach 5 ft. Hit: 5
 * (1d6 + 2) Slashing damage. The target is poisoned." becomes rolls, an attack, a save DC and a
 * condition link, and turns back into the same words for editing. Both editions' wordings work.
 */

const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
]; // prettier-ignore

/** Attack labels, longest first so "Melee or Ranged…" is found before "Melee…". */
const ATTACKS: [label: string, tag: string][] = [
  ['Melee or Ranged Weapon Attack:', '{@atk mw,rw}'],
  ['Melee or Ranged Spell Attack:', '{@atk ms,rs}'],
  ['Melee or Ranged Attack Roll:', '{@atkr m,r}'],
  ['Melee Weapon Attack:', '{@atk mw}'],
  ['Ranged Weapon Attack:', '{@atk rw}'],
  ['Melee Spell Attack:', '{@atk ms}'],
  ['Ranged Spell Attack:', '{@atk rs}'],
  ['Melee Attack Roll:', '{@atkr m}'],
  ['Ranged Attack Roll:', '{@atkr r}'],
];

/** Tags plain statblock text. Text that already has tags keeps them. */
export function tagStatText(text: string): string {
  let out = text;
  for (const [label, tag] of ATTACKS) out = out.split(label).join(tag);
  // "+4 to hit" (2014) and the bonus right after a 2024 attack label.
  out = out.replace(
    /([+-])(\d+) to hit\b/g,
    (_, sign: string, n: string) => `{@hit ${sign === '-' ? '-' : ''}${n}} to hit`,
  );
  out = out.replace(
    /(\{@atkr [^}]+\}) ([+-])(\d+)\b/g,
    (_, atk: string, sign: string, n: string) => `${atk} {@hit ${sign === '-' ? '-' : ''}${n}}`,
  );
  out = out.replace(/(^|[\s.(])Hit:\s*/g, '$1{@h}');
  out = out.replace(/\bDC (\d+)\b/g, '{@dc $1}');
  out = tagDice(out);
  out = out.replace(
    new RegExp(`(?<![{@\\w])\\b(${CONDITIONS.join('|')})\\b`, 'gi'),
    (word: string, _c: string, offset: number, all: string) =>
      // Not inside an existing tag.
      all.lastIndexOf('{', offset) > all.lastIndexOf('}', offset) ? word : `{@condition ${word}}`,
  );
  return out;
}

/** Plain words for editing: the tags this module writes are read back as text. */
export function untagStatText(text: string): string {
  let out = text;
  for (const [label, tag] of ATTACKS) out = out.split(tag).join(label);
  return out
    .replace(/\{@hit (-?)(\d+)\}/g, (_, minus: string, n: string) => `${minus ? '-' : '+'}${n}`)
    .replace(/\{@h\}/g, 'Hit: ')
    .replace(/\{@dc (\d+)\}/g, 'DC $1')
    .replace(
      /\{@(?:dice|damage|d20|condition|spell|item|creature|skill|sense|action|status) ([^}|]*)[^}]*\}/g,
      '$1',
    )
    .replace(/\{@recharge (\d)\}/g, (_, n: string) => `(Recharge ${n}${n === '6' ? '' : '–6'})`)
    .replace(/\{@recharge\}/g, '(Recharge 6)');
}
