import type { RawEntity } from '@boh/data5e';
import { emptyExtraction, isObj, merge, type Extraction, type Issues } from '../model';
import { lineageAbilities, readAbilities } from './abilities';
import { readEquipmentRows } from './equipment';
import { readFeats } from './feats';
import { PROFICIENCY_FIELDS, readProficiencies, type ProficiencyField } from './proficiencies';
import { readAdditionalSpells } from './spells';
import { progressionDelta } from './classes';

/**
 * Grants and choices of a species, subspecies, background, feat, optional feature or class
 * feature, from its structured fields. Class levels (spell progressions, subclass…) are read by
 * `readClassLevel` instead.
 */

const SIZE_NAMES: Record<string, string> = {
  T: 'Tiny',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  H: 'Huge',
  G: 'Gargantuan',
};

const present = (v: unknown) => v !== undefined && v !== null;

export function readEntity(entity: RawEntity, key: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  for (const field of Object.keys(PROFICIENCY_FIELDS) as ProficiencyField[]) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    merge(
      out,
      readProficiencies(field, value, `${key}/${field.replace('Proficiencies', '')}`, issues),
    );
  }

  // `null` (in a subrace): the race's value is removed.
  if (present(entity.ability)) merge(out, readAbilities(entity.ability, `${key}/ability`, issues));
  else if (entity.lineage === 'VRGR' || entity.lineage === true)
    merge(out, lineageAbilities(`${key}/ability`));

  if (present(entity.feats)) merge(out, readFeats(entity.feats, `${key}/feats`, issues));
  if (present(entity.additionalSpells))
    merge(out, readAdditionalSpells(entity.additionalSpells, `${key}/spells`, issues));

  // Backgrounds: equipment rows. (Classes keep theirs in an object; see readClassLevel.)
  if (Array.isArray(entity.startingEquipment))
    merge(out, readEquipmentRows(entity.startingEquipment, `${key}/equipment`, issues));

  // Feats that grant optional features ("Fighting Initiate": one Fighting Style).
  if (Array.isArray(entity.optionalfeatureProgression))
    for (const p of entity.optionalfeatureProgression) {
      if (!isObj(p)) continue;
      const n = progressionDelta(p.progression, 1);
      if (n > 0)
        out.choices.push({
          id: `${key}/optionalfeature:${String(p.name).toLowerCase()}`,
          kind: 'optionalfeature',
          count: n,
          label: `Choose ${String(n)} ${String(p.name)}`,
          filter: {
            type: 'optionalfeature',
            featureTypes: Array.isArray(p.featureType) ? p.featureType.map(String) : [],
          },
        });
    }

  // "Small or Medium" (2024 humans, tieflings…).
  const sizes = Array.isArray(entity.size)
    ? entity.size.filter((s): s is string => typeof s === 'string')
    : [];
  if (sizes.length > 1)
    out.choices.push({
      id: `${key}/size`,
      kind: 'size',
      count: 1,
      label: 'Choose your size',
      options: sizes.map((s) => SIZE_NAMES[s] ?? s),
    });
  else if (sizes[0]) out.grants.push({ kind: 'size', value: SIZE_NAMES[sizes[0]] ?? sizes[0] });
  return out;
}
