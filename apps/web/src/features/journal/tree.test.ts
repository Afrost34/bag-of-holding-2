import { describe, expect, it } from 'vitest';
import { buildTagTree, buildTree, moveTarget } from './tree';

describe('journal tree', () => {
  it('nests notes in folders, folders first, natural order', () => {
    const tree = buildTree(
      ['Session 10.md', 'Session 2.md', 'Places/Waterdeep.md'],
      ['_assets/map.png'],
      ['Places', 'Empty', '_assets'],
    );
    expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual([
      'folder:_assets',
      'folder:Empty',
      'folder:Places',
      'note:Session 2',
      'note:Session 10',
    ]);
    expect(tree[2]?.children.map((n) => n.path)).toEqual(['Places/Waterdeep.md']);
    expect(tree[0]?.children[0]).toMatchObject({ kind: 'file', name: 'map.png' });
  });
});

describe('moveTarget', () => {
  const existing = ['Places', 'Places/Waterdeep.md', 'Session 1.md', 'NPCs'];
  it('moves notes and folders into folders and to the top level', () => {
    expect(moveTarget('Session 1.md', 'Places', existing, false)).toEqual({
      ok: true,
      to: 'Places/Session 1.md',
    });
    expect(moveTarget('Places/Waterdeep.md', '', existing, false)).toEqual({
      ok: true,
      to: 'Waterdeep.md',
    });
    expect(moveTarget('NPCs', 'Places', existing, true)).toEqual({ ok: true, to: 'Places/NPCs' });
  });
  it('refuses no-op moves, folders into themselves and overwrites', () => {
    expect(moveTarget('Places/Waterdeep.md', 'Places', existing, false).ok).toBe(false);
    expect(moveTarget('Places', 'Places/Sub', existing, true).ok).toBe(false);
    expect(moveTarget('Waterdeep.md', 'Places', [...existing, 'Waterdeep.md'], false).ok).toBe(
      false,
    );
  });
});

describe('buildTagTree', () => {
  it('nests tags and counts notes with sub-tags', () => {
    const tree = buildTagTree(
      new Map([
        ['A.md', ['npc', 'faction/zhentarim']],
        ['B.md', ['faction/harpers', 'Faction']],
        ['C.md', ['npc']],
      ]),
    );
    expect(tree.map((t) => [t.tag, t.count])).toEqual([
      ['faction', 2],
      ['npc', 2],
    ]);
    const faction = tree[0];
    expect(faction?.notes).toEqual(['B.md']);
    expect(faction?.children.map((c) => [c.name, c.notes])).toEqual([
      ['harpers', ['B.md']],
      ['zhentarim', ['A.md']],
    ]);
  });
});
