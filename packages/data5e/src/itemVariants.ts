import { DAMAGE_TYPES } from './format';
import type { RawEntity } from './identity';
import { isObj } from './json';
import { applyAllProperties } from './templates';

export { applyProperties } from './templates';

/**
 * Specific magic item variants ("+1 Longsword", "Adamantine Breastplate"), generated from generic
 * variants (`magicvariant`) applied to base items (`baseitem`), as 5etools does in the browser.
 * A port of `Renderer.item._createSpecificVariants` (js/render.js, 5etools v2.36.1); keep the two
 * in step when the pinned version changes.
 */

type Obj = Record<string, unknown>;

/** Marks generated items, which have no file of their own in 5etools. */
export const SPECIFIC_VARIANT_FLAG = '_specificVariant';

// region Matching

/** 5etools edition rules (see the table in `_createSpecificVariants_isEditionMatch`). */
export function isEditionMatch(base: Obj, variant: Obj): boolean {
  const b = base.edition ?? null;
  const v = variant.edition ?? null;
  if (b === v) return true;
  if (b === 'classic') return false;
  if (b === null) return true;
  if (b === 'one') return v !== 'classic';
  return false;
}

function isMatching(candidateVal: unknown, requirement: unknown, isEvery: boolean): boolean {
  if (Array.isArray(requirement)) {
    return Array.isArray(candidateVal)
      ? candidateVal.some((it) => requirement.includes(it))
      : requirement.includes(candidateVal);
  }
  if (isObj(requirement)) {
    return isRequiresExcludesMatch(candidateVal, requirement, isEvery);
  }
  return Array.isArray(candidateVal)
    ? candidateVal.some((val) => val === requirement)
    : requirement === candidateVal;
}

function isRequiresExcludesMatch(
  candidate: unknown,
  requirements: unknown,
  isEvery = false,
): boolean {
  if (!isObj(candidate) || !isObj(requirements)) return false;
  for (const [key, requirement] of Object.entries(requirements)) {
    const match = isMatching(candidate[key], requirement, isEvery);
    if (isEvery && !match) return false;
    if (!isEvery && match) return true;
  }
  return isEvery;
}

export function appliesTo(base: Obj, variant: Obj): boolean {
  if (base.packContents !== undefined) return false; // e.g. "Arrows (20)"
  if (!isObj(variant.inherits)) return false;
  if (!isEditionMatch(base, variant)) return false;
  const requires = Array.isArray(variant.requires) ? variant.requires : [];
  if (!requires.some((r) => isRequiresExcludesMatch(base, r, true))) return false;
  return !isRequiresExcludesMatch(base, variant.excludes);
}

// endregion

// region Creation

/** `[[baseItem.value]] * 4` → 4 × the base item's value. Only + - * / and parentheses. */
export function evaluateExpression(expression: string, base: Obj, item: Obj): number | null {
  const filled = expression.replace(/\[\[([^\]]+)]]/g, (_m, path: string) => {
    const [root = '', ...rest] = path.split('.');
    let value: unknown = root === 'baseItem' ? base : root === 'item' ? item : item[root];
    for (const part of rest) {
      value = isObj(value) ? value[part] : undefined;
    }
    return typeof value === 'number' ? String(value) : 'NaN';
  });
  return evaluateArithmetic(filled);
}

/** A tiny recursive-descent evaluator: no `eval`, numbers and + - * / ( ) only. */
function evaluateArithmetic(input: string): number | null {
  const tokens = input.match(/\d+(?:\.\d+)?|[-+*/()]|NaN/g) ?? [];
  if (tokens.length === 0 || tokens.join('') !== input.replace(/\s+/g, '')) return null;
  let i = 0;
  const peek = () => tokens[i];
  const factor = (): number => {
    const t = tokens[i++];
    if (t === '(') {
      const v = expr();
      i++; // ')'
      return v;
    }
    if (t === '-') return -factor();
    return Number(t);
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') v = tokens[i++] === '*' ? v * factor() : v / factor();
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') v = tokens[i++] === '+' ? v + term() : v - term();
    return v;
  };
  const result = expr();
  return Number.isFinite(result) ? result : null;
}

const VULN_RES_IMMUNE = ['vulnerable', 'resist', 'immune'] as const;
type DamageProp = (typeof VULN_RES_IMMUNE)[number];

const list = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
const unique = (values: unknown[]): unknown[] => [...new Set(values)];

/** A value appears in only one of vulnerable / resist / immune: the variant's wins. */
function mergeVulnerableResistImmune(item: Obj, inherits: Obj): void {
  const fromBase = new Map<DamageProp, unknown[]>();
  for (const prop of VULN_RES_IMMUNE) {
    if (Array.isArray(item[prop])) fromBase.set(prop, [...list(item[prop])]);
  }
  for (const prop of VULN_RES_IMMUNE) {
    const val = inherits[prop];
    if (val === undefined) continue;
    if (val === null) {
      fromBase.delete(prop);
      continue;
    }
    const values = new Set<string>();
    for (const it of list(val)) {
      if (typeof it === 'string') values.add(it);
      for (const s of isObj(it) ? list(it[prop]) : []) if (typeof s === 'string') values.add(s);
    }
    for (const other of VULN_RES_IMMUNE) {
      const current = fromBase.get(other);
      if (other === prop || !current) continue;
      const kept = current.filter((it) => {
        if (typeof it === 'string') return !values.has(it);
        if (isObj(it) && Array.isArray(it[other])) {
          it[other] = list(it[other]).filter((s) => typeof s !== 'string' || !values.has(s));
        }
        return true;
      });
      if (kept.length) fromBase.set(other, kept);
      else fromBase.delete(other);
    }
  }
  for (const prop of VULN_RES_IMMUNE) {
    const base = fromBase.get(prop);
    const inherited = inherits[prop];
    item[prop] =
      base || Array.isArray(inherited) ? unique([...(base ?? []), ...list(inherited)]) : undefined;
  }
}

const propUid = (p: unknown): unknown => (isObj(p) ? p.uid : p);

/** Base item fields a magic variant never keeps (its own value, page and reprint info apply). */
const NOT_INHERITED = new Set([
  'value', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'page', 'reprintedAs',
  'referenceSources', 'hasFluff', 'hasFluffImages',
]); // prettier-ignore

/** Drops undefined fields (properties a variant removed). */
const compact = (o: Obj): RawEntity =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function createSpecificVariant(base: Obj, variant: Obj): RawEntity {
  const inherits = isObj(variant.inherits) ? variant.inherits : {};
  const item: Obj = Object.fromEntries(
    Object.entries(structuredClone<Obj>(base)).filter(([k]) => !NOT_INHERITED.has(k)),
  );
  item.baseItem = `${String(base.name)}|${String(base.source)}`;
  const baseEntries = list(structuredClone<unknown>(base.entries));
  let variantEntries: unknown[] = [];

  const injectable: Obj = {
    baseName: base.name,
    dmgType: typeof base.dmgType === 'string' ? (DAMAGE_TYPES[base.dmgType] ?? base.dmgType) : null,
    bonusAc: inherits.bonusAc,
    bonusWeapon: inherits.bonusWeapon,
    bonusWeaponAttack: inherits.bonusWeaponAttack,
    bonusWeaponDamage: inherits.bonusWeaponDamage,
    bonusWeaponCritDamage: inherits.bonusWeaponCritDamage,
    bonusSpellAttack: inherits.bonusSpellAttack,
    bonusSpellSaveDc: inherits.bonusSpellSaveDc,
    bonusSavingThrow: inherits.bonusSavingThrow,
  };

  // "Remove"s first: { nameRemove: "Reagent", nameSuffix: "Poisonous Reagent" }.
  const ordered = Object.entries(inherits).sort(
    ([a], [b]) => Number(b.includes('Remove')) - Number(a.includes('Remove')),
  );
  for (const [prop, val] of ordered) {
    switch (prop) {
      case 'namePrefix':
        item.name = `${String(val)}${String(item.name)}`;
        break;
      case 'nameSuffix':
        item.name = `${String(item.name)}${String(val)}`;
        break;
      case 'nameRemove':
        item.name = String(item.name).split(String(val)).join('');
        break;
      case 'entries':
        variantEntries = list(applyAllProperties(val, injectable));
        break;
      case 'vulnerable':
      case 'resist':
      case 'immune':
        break; // merged below
      case 'conditionImmune':
        item.conditionImmune = unique([...list(item.conditionImmune), ...list(val)]);
        break;
      case 'weightExpression':
      case 'valueExpression': {
        const result = typeof val === 'string' ? evaluateExpression(val, base, item) : null;
        if (result !== null) item[prop === 'weightExpression' ? 'weight' : 'value'] = result;
        break;
      }
      case 'barding':
        item.bardingType = base.type;
        break;
      case 'propertyAdd': {
        const existing = list(item.property);
        const added = list(val).filter((p) => !existing.some((e) => propUid(e) === propUid(p)));
        item.property = [...existing, ...added];
        break;
      }
      case 'propertyRemove': {
        const removed = list(val);
        const kept = list(item.property).filter((p) => !removed.includes(propUid(p)));
        item.property = kept.length ? kept : undefined;
        break;
      }
      default:
        item[prop] = val;
    }
  }
  mergeVulnerableResistImmune(item, inherits);

  item.entries = [...variantEntries, ...baseEntries];
  // Generic variants keep their source in `inherits` (5etools copies it up when loading).
  item.genericVariant = { name: variant.name, source: variant.source ?? inherits.source };
  item[SPECIFIC_VARIANT_FLAG] = true;
  return compact(item);
}

/** Every specific variant of every base item. */
export function generateSpecificVariants(
  baseItems: readonly Obj[],
  variants: readonly Obj[],
): RawEntity[] {
  const out: RawEntity[] = [];
  for (const base of baseItems) {
    for (const variant of variants) {
      if (appliesTo(base, variant)) out.push(createSpecificVariant(base, variant));
    }
  }
  return out;
}

// endregion
