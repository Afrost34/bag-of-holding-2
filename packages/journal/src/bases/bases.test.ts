import { describe, expect, it } from 'vitest';
import { parseBase, propertiesForNew, runView } from './base';
import { evaluate, parseExpr, type NoteInfo } from './expr';

const note = (
  path: string,
  properties: Record<string, unknown>,
  tags: string[] = [],
): NoteInfo => ({
  path,
  properties,
  tags,
  links: [],
});

const tibia = note('NPCs/Mother Tibia.md', {
  type: 'npc',
  location: '[[Rustcrown]]',
  faction: 'Old Faith',
  danger_level: 'Low',
  level: 5,
});
const varr = note('NPCs/Talmach Varr.md', {
  type: 'npc',
  location: 'Rustcrown',
  danger_level: 'High',
  level: 9,
});
const kael = note(
  'NPCs/Kael.md',
  { type: 'npc', location: ['[[Heliark]]'], danger_level: 'Extreme' },
  ['villain'],
);
const rustcrown = note('Places/Rustcrown.md', {
  type: 'location',
  title: 'Rustcrown',
  Region: 'North',
});
const heliark = note('Places/Heliark.md', { type: 'location', region: 'South' });
const notes = [tibia, varr, kael, rustcrown, heliark];

const paths = notes.map((n) => n.path);
const resolve = (target: string) =>
  paths.find((p) => p.toLowerCase().endsWith(`/${target.toLowerCase()}.md`)) ?? null;

const run = (src: string, n: NoteInfo, self?: NoteInfo) =>
  evaluate(parseExpr(src), { note: n, self, resolve });

describe('base expressions', () => {
  it('compares properties, with = as ==', () => {
    expect(run('type == "npc"', tibia)).toBe(true);
    expect(run('type = "npc" && level > 3', tibia)).toBe(true);
    expect(run('danger_level == "High" || danger_level == "Extreme"', tibia)).toBe(false);
    expect(run('!(level >= 6)', tibia)).toBe(true);
    expect(run('note.Level * 2', tibia)).toBe(10);
  });
  it('knows files, tags and folders', () => {
    expect(run('file.name', kael)).toBe('Kael');
    expect(run('file.hasTag("villain")', kael)).toBe(true);
    expect(run('file.inFolder("NPCs")', kael)).toBe(true);
    expect(run('file.inFolder("Places")', kael)).toBe(false);
    expect(run('location.isEmpty()', kael)).toBe(false);
    expect(run('missing.isEmpty()', kael)).toBe(true);
  });
  it('matches links, names and lists against `this`', () => {
    expect(run('location.contains(this)', tibia, rustcrown)).toBe(true);
    expect(run('location.contains(this)', varr, rustcrown)).toBe(true);
    expect(run('location.contains(this)', kael, rustcrown)).toBe(false);
    expect(run('location == this', tibia, rustcrown)).toBe(true);
    expect(run('location.contains(this)', kael, heliark)).toBe(true);
  });
  it('reports syntax errors', () => {
    expect(() => parseExpr('type == ')).toThrow();
    expect(() => parseExpr('type == "npc')).toThrow();
  });
});

const NPC_BASE = `views:
  - type: table
    name: All NPCs
    filters:
      and:
        - type == "npc"
    groupBy:
      property: location
      direction: ASC
    sort:
      - property: level
        direction: DESC
    columns:
      - name: Name
        key: file.name
      - name: Danger
        key: danger_level
  - type: table
    name: High Danger
    filters:
      and:
        - type == "npc"
        - or:
            - danger_level == "High"
            - danger_level == "Extreme"
    order:
      - file.name
      - note.level
    properties: {}
`;

describe('bases', () => {
  const base = parseBase(NPC_BASE);
  it('reads views, legacy columns and order', () => {
    expect(base.views.map((v) => v.name)).toEqual(['All NPCs', 'High Danger']);
    expect(base.views[0]?.columns).toEqual([
      { key: 'file.name', name: 'Name' },
      { key: 'danger_level', name: 'Danger' },
    ]);
    expect(base.views[1]?.columns.map((c) => c.key)).toEqual(['file.name', 'level']);
  });
  it('filters, sorts and groups (a link and plain text to the same place group together)', () => {
    const view = base.views[0];
    if (!view) throw new Error('no view');
    const result = runView(base, view, notes, { resolve: (t) => resolve(t) });
    expect(result.total).toBe(3);
    expect(result.groups.map((g) => [g.label, g.rows.map((r) => r.values[0])])).toEqual([
      ['Heliark', ['Kael']],
      ['Rustcrown', ['Talmach Varr', 'Mother Tibia']],
    ]);
  });
  it('applies or-filters, a clicked sort and a search', () => {
    const view = base.views[1];
    if (!view) throw new Error('no view');
    const result = runView(base, view, notes, {
      resolve: (t) => resolve(t),
      sort: { property: 'file.name', direction: 'ASC' },
    });
    expect(result.groups[0]?.rows.map((r) => r.values[0])).toEqual(['Kael', 'Talmach Varr']);
    const searched = runView(base, view, notes, { resolve: (t) => resolve(t), search: 'talm' });
    expect(searched.total).toBe(1);
  });
  it('reports a bad filter instead of failing', () => {
    const bad = parseBase('views:\n  - type: table\n    filters:\n      and:\n        - type ==\n');
    const view = bad.views[0];
    if (!view) throw new Error('no view');
    expect(runView(bad, view, notes, { resolve: () => null }).error).toMatch(/type ==/);
    expect(parseBase('views: [').error).toBeDefined();
  });
  it('gives new notes the properties the view filters on', () => {
    const view = base.views[0];
    if (!view) throw new Error('no view');
    expect(propertiesForNew(base, view)).toEqual({ type: 'npc' });
    const here = parseBase(
      [
        'views:',
        '  - type: table',
        '    filters:',
        '      and:',
        '        - type == "npc"',
        '        - location.contains(this)',
      ].join('\n'),
    );
    const hereView = here.views[0];
    if (!hereView) throw new Error('no view');
    expect(propertiesForNew(here, hereView, 'Rustcrown')).toEqual({
      type: 'npc',
      location: '[[Rustcrown]]',
    });
  });
});
