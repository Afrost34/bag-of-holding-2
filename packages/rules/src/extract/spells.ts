import {
  ABILITIES,
  emptyExtraction,
  isAbility,
  isObj,
  num,
  refKey,
  type Branch,
  type Extraction,
  type Issues,
  type SpellMode,
  type SpellUses,
} from '../model';

/**
 * `additionalSpells`: spells a class, species, feat… gives or lets you pick.
 *
 *   [{ "name": "High Elf", "ability": { "choose": ["int", "wis", "cha"] },
 *      "known": { "1": { "_": [{ "choose": "level=0|class=Wizard" }] } },
 *      "innate": { "3": { "daily": { "1": ["detect magic|xphb"] } } } }]
 *
 * Level keys are character (or class) levels; `_` means from the start; `s3` (expanded lists
 * only) means "once you can cast 3rd-level spells". Several entries are alternatives.
 */

const MODES: readonly SpellMode[] = ['innate', 'known', 'prepared', 'expanded'];
const PER = new Set(['daily', 'rest', 'will', 'ritual', 'resource']);

/** `level=0;1|class=Wizard` → `{ level: ['0', '1'], class: ['wizard'] }`. */
export function parseSpellFilter(filter: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of filter.split('|')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim().toLowerCase()] = part
      .slice(eq + 1)
      .split(';')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return out;
}

interface Ctx {
  id: string;
  issues: Issues;
  out: Extraction;
  pick: number;
  /** Set while reading an `s3`-style key: spells had once that level can be cast. */
  slotLevel?: number | undefined;
}

function levelOf(key: string): number {
  if (key === '_') return 1;
  const n = Number(key.replace(/^s/, ''));
  // Spell-level keys (expanded lists) are reached when that level can be cast; the list addition
  // itself is harmless earlier, so treat it as known from level 1.
  return key.startsWith('s') ? 1 : Number.isFinite(n) && n > 0 ? n : 1;
}

function readItems(
  ctx: Ctx,
  items: unknown,
  mode: SpellMode,
  level: number,
  uses: SpellUses | undefined,
) {
  const slotLevel = ctx.slotLevel;
  if (!Array.isArray(items)) {
    ctx.issues.add(ctx.id, `spell list is not a list`);
    return;
  }
  for (const item of items) {
    if (typeof item === 'string') {
      ctx.out.grants.push({
        kind: 'spell',
        key: refKey('spell', item),
        mode,
        level,
        ...(uses ? { uses } : {}),
        ...(slotLevel ? { slotLevel } : {}),
      });
    } else if (isObj(item) && typeof item.choose === 'string') {
      const count = num(item.count) ?? 1;
      const n = ctx.pick++;
      ctx.out.choices.push({
        id: `${ctx.id}/${mode}/${String(n)}`,
        kind: 'spell',
        count,
        level,
        label: count === 1 ? 'Choose a spell' : `Choose ${String(count)} spells`,
        filter: { type: 'spell', filter: item.choose },
      });
      for (const k of Object.keys(item))
        if (k !== 'choose' && k !== 'count')
          ctx.issues.add(ctx.id, `unknown spell pick field ${k}`);
    } else if (isObj(item) && isObj(item.choose) && Array.isArray(item.choose.from)) {
      // `{ choose: { from: ["hex", "false life"], count: 2 } }`: a pick from a fixed list.
      const count = num(item.choose.count) ?? 1;
      const n = ctx.pick++;
      ctx.out.choices.push({
        id: `${ctx.id}/${mode}/${String(n)}`,
        kind: 'spell',
        count,
        level,
        label: count === 1 ? 'Choose a spell' : `Choose ${String(count)} spells`,
        options: item.choose.from.map((s) => refKey('spell', String(s))),
      });
    } else if (isObj(item) && typeof item.all === 'string') {
      ctx.out.grants.push({ kind: 'spellList', filter: item.all, level });
    } else ctx.issues.add(ctx.id, `unknown spell item ${JSON.stringify(item)}`);
  }
}

function readContent(ctx: Ctx, content: unknown, mode: SpellMode, level: number) {
  if (Array.isArray(content)) {
    readItems(ctx, content, mode, level, undefined);
    return;
  }
  if (!isObj(content)) {
    ctx.issues.add(ctx.id, `spell content ${JSON.stringify(content)}`);
    return;
  }
  for (const [key, value] of Object.entries(content)) {
    if (key === '_') readItems(ctx, value, mode, level, undefined);
    else if (key === 'will' || key === 'ritual') readItems(ctx, value, mode, level, { per: key });
    else if (PER.has(key) && isObj(value)) {
      for (const [n, items] of Object.entries(value)) {
        const each = n.endsWith('e');
        const count = Number(each ? n.slice(0, -1) : n);
        const per = key as SpellUses['per'];
        if (isAbility(n)) readItems(ctx, items, mode, level, { per, countAbility: n });
        else {
          if (!Number.isFinite(count)) ctx.issues.add(ctx.id, `uses ${key}.${n}`);
          readItems(ctx, items, mode, level, { per, count, ...(each ? { each } : {}) });
        }
      }
    } else ctx.issues.add(ctx.id, `unknown spell grouping ${key}`);
  }
}

function readAlternative(alt: Record<string, unknown>, id: string, issues: Issues): Extraction {
  const ctx: Ctx = { id, issues, out: emptyExtraction(), pick: 0 };
  for (const [key, value] of Object.entries(alt)) {
    if (MODES.includes(key as SpellMode)) {
      if (!isObj(value)) {
        issues.add(id, `${key} is not an object`);
        continue;
      }
      for (const [lvl, content] of Object.entries(value)) {
        if (!/^(_|s?\d+)$/.test(lvl)) issues.add(id, `level key ${lvl}`);
        ctx.slotLevel = lvl.startsWith('s') ? Number(lvl.slice(1)) || undefined : undefined;
        readContent(ctx, content, key as SpellMode, levelOf(lvl));
        ctx.slotLevel = undefined;
      }
    } else if (key === 'ability') {
      if (isObj(value) && Array.isArray(value.choose)) {
        const options = value.choose.filter(isAbility);
        ctx.out.choices.push({
          id: `${id}/ability`,
          kind: 'spellAbility',
          count: 1,
          label: 'Choose the spellcasting ability',
          options: options.length ? options : [...ABILITIES],
        });
      } else if (!isAbility(value) && value !== 'inherit')
        issues.add(id, `spell ability ${JSON.stringify(value)}`);
    } else if (key !== 'name' && key !== 'resourceName') issues.add(id, `unknown field ${key}`);
  }
  return ctx.out;
}

/** The fixed spellcasting ability of an alternative, when there is one. */
export function spellAbilityOf(alt: unknown) {
  return isObj(alt) && isAbility(alt.ability) ? alt.ability : undefined;
}

export function readAdditionalSpells(value: unknown, id: string, issues: Issues): Extraction {
  const alts = (Array.isArray(value) ? value : [value]).filter(isObj);
  if (alts.length === 1 && alts[0]) return readAlternative(alts[0], id, issues);
  const branches: Branch[] = alts.map((alt, i) => {
    const ex = readAlternative(alt, `${id}/${String(i)}`, issues);
    return {
      id: String(i),
      label: typeof alt.name === 'string' ? alt.name : `Option ${String(i + 1)}`,
      ...ex,
    };
  });
  return {
    grants: [],
    choices: [
      {
        id,
        kind: 'alternative',
        count: 1,
        label: 'Choose one',
        options: branches.map((b) => b.id),
        branches,
      },
    ],
  };
}
