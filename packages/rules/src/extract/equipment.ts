import { untag } from '@boh/data5e';
import {
  emptyExtraction,
  isObj,
  merge,
  num,
  refKey,
  type Branch,
  type Extraction,
  type Issues,
} from '../model';

/**
 * Starting equipment. Classes keep it under `startingEquipment.defaultData`, backgrounds directly
 * under `startingEquipment`. Each row is either fixed (`{ "_": [...] }`) or a pick between
 * lettered bundles (`{ "a": [...], "b": [...] }`; 2024 uses `A`/`B`, where B is often just gold).
 *
 * Items are `"rapier|phb"`, `{ item, quantity, containsValue }`, `{ equipmentType }` (any item of
 * a group, picked later), `{ special: "set of weighted dice" }` or `{ value }` (copper pieces).
 */

const ITEM_FIELDS = new Set(['item', 'quantity', 'containsValue', 'displayName', 'worthValue']);

function readItems(items: unknown, id: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  if (!Array.isArray(items)) {
    issues.add(id, 'equipment bundle is not a list');
    return out;
  }
  items.forEach((it, n) => {
    if (typeof it === 'string') {
      out.grants.push({ kind: 'item', key: refKey('item', it), quantity: 1 });
      return;
    }
    if (!isObj(it)) {
      issues.add(id, `equipment ${JSON.stringify(it)}`);
      return;
    }
    const quantity = num(it.quantity) ?? 1;
    if (typeof it.item === 'string') {
      out.grants.push({ kind: 'item', key: refKey('item', it.item), quantity });
      // "a pouch containing 15 gp"
      const contains = num(it.containsValue);
      if (contains) out.grants.push({ kind: 'money', cp: contains });
      for (const k of Object.keys(it))
        if (!ITEM_FIELDS.has(k)) issues.add(id, `unknown equipment field ${k}`);
    } else if (typeof it.equipmentType === 'string') {
      out.choices.push({
        id: `${id}/${String(n)}`,
        kind: 'item',
        count: quantity,
        label: `Choose ${quantity === 1 ? 'an item' : `${String(quantity)} items`}`,
        filter: { type: 'items', equipmentType: it.equipmentType },
      });
    } else if (Array.isArray(it.equipmentTypes)) {
      // Any item from one of several groups.
      out.choices.push({
        id: `${id}/${String(n)}`,
        kind: 'item',
        count: quantity,
        label: 'Choose an item',
        filter: { type: 'items', equipmentType: it.equipmentTypes.map(String).join(';') },
      });
    } else if (typeof it.special === 'string') {
      out.grants.push({ kind: 'special', text: it.special, quantity });
    } else if (typeof it.value === 'number') {
      out.grants.push({ kind: 'money', cp: it.value });
    } else issues.add(id, `equipment ${JSON.stringify(it)}`);
  });
  return out;
}

const coins = (cp: number) =>
  cp % 100 === 0
    ? `${String(cp / 100)} GP`
    : cp % 10 === 0
      ? `${String(cp / 10)} SP`
      : `${String(cp)} CP`;

function describe(ex: Extraction): string {
  const parts = ex.grants.map((g) =>
    g.kind === 'item'
      ? `${g.quantity > 1 ? `${String(g.quantity)} ` : ''}${g.key.slice(g.key.indexOf(':') + 1, g.key.lastIndexOf('@'))}`
      : g.kind === 'money'
        ? coins(g.cp)
        : g.kind === 'special'
          ? g.text
          : '',
  );
  parts.push(...ex.choices.map((c) => c.label.replace(/^Choose /, '')));
  return parts.filter(Boolean).join(', ') || 'Nothing';
}

export function readEquipmentRows(rows: unknown, id: string, issues: Issues): Extraction {
  const out = emptyExtraction();
  if (!Array.isArray(rows)) {
    issues.add(id, 'equipment rows are not a list');
    return out;
  }
  rows.forEach((row, r) => {
    if (!isObj(row)) {
      issues.add(id, `equipment row ${JSON.stringify(row)}`);
      return;
    }
    const rowId = `${id}/${String(r)}`;
    const letters = Object.keys(row).filter((k) => k !== '_');
    if ('_' in row) merge(out, readItems(row._, rowId, issues));
    if (letters.length === 0) return;
    const branches: Branch[] = letters.map((letter) => {
      const ex = readItems(row[letter], `${rowId}/${letter}`, issues);
      return { id: letter, label: `(${letter}) ${describe(ex)}`, ...ex };
    });
    out.choices.push({
      id: rowId,
      kind: 'alternative',
      count: 1,
      label: `Choose ${letters.map((l) => l.toUpperCase()).join(' or ')}`,
      options: letters,
      branches,
    });
  });
  return out;
}

/** A class's starting equipment, with the 2014 "or roll for gold" alternative. */
export function readClassEquipment(value: unknown, id: string, issues: Issues): Extraction {
  if (!isObj(value)) return emptyExtraction();
  for (const k of Object.keys(value))
    if (
      ![
        'additionalFromBackground',
        'default',
        'goldAlternative',
        'defaultData',
        'entries',
      ].includes(k)
    )
      issues.add(id, `unknown startingEquipment field ${k}`);
  const items = readEquipmentRows(value.defaultData ?? [], id, issues);
  if (typeof value.goldAlternative !== 'string') return items;
  return {
    grants: [],
    choices: [
      {
        id: `${id}/gold`,
        kind: 'alternative',
        count: 1,
        label: 'Take the equipment or roll for gold',
        options: ['equipment', 'gold'],
        branches: [
          { id: 'equipment', label: 'Starting equipment', ...items },
          {
            id: 'gold',
            label: `Roll ${untag(value.goldAlternative)} GP`,
            grants: [
              { kind: 'special', text: `${untag(value.goldAlternative)} GP (rolled)`, quantity: 1 },
            ],
            choices: [],
          },
        ],
      },
    ],
  };
}
