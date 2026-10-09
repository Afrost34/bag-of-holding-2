import { describe, expect, it } from 'vitest';
import { expandItemEntries } from './itemEntries';

const templates: Record<string, Record<string, unknown>> = {
  'ring of resistance|xdmg': {
    name: 'Ring of Resistance',
    source: 'XDMG',
    entriesTemplate: [
      'You have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage while wearing this ring. The ring is set with {{item.detail1}}.',
    ],
  },
};
const find = (name: string, source: string) =>
  templates[`${name.toLowerCase()}|${source.toLowerCase()}`];

describe('item entries', () => {
  it('writes out an item entry with the item’s own fields', () => {
    const ring = {
      name: 'Ring of Necrotic Resistance',
      source: 'XDMG',
      resist: ['necrotic'],
      detail1: 'jet',
      entries: ['{#itemEntry Ring of Resistance|XDMG}'],
    };
    expect(expandItemEntries(ring, find)?.entries).toEqual([
      'You have {@variantrule Resistance|XPHB} to necrotic damage while wearing this ring. The ring is set with jet.',
    ]);
    const two = { ...ring, resist: ['fire', 'cold'] };
    expect(String((expandItemEntries(two, find)?.entries as string[])[0])).toContain(
      'to fire and cold damage',
    );
  });

  it('leaves items without item entries (or with unknown ones) alone', () => {
    expect(expandItemEntries({ name: 'Rope', entries: ['Strong.'] }, find)).toBeNull();
    expect(
      expandItemEntries(
        { name: 'X', source: 'XDMG', entries: ['{#itemEntry Nothing|XDMG}'] },
        find,
      ),
    ).toBeNull();
  });
});
