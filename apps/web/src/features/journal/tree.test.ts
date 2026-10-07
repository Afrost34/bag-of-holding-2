import { describe, expect, it } from 'vitest';
import { buildTree } from './tree';

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
