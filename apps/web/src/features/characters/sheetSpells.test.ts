import type { HeldGrant } from '@boh/rules';
import { describe, expect, it } from 'vitest';
import { sheetSpells } from './sheetSpells';

const spell = (key: string, from: string, extra: Partial<HeldGrant> = {}): HeldGrant =>
  ({ kind: 'spell', key, mode: 'known', level: 1, from, ...extra }) as HeldGrant;

describe('sheet spells', () => {
  it('says where each spell comes from and how it is had', () => {
    const rows = sheetSpells(
      [
        spell('spell:light@xphb', 'class:cleric@xphb', { choice: 'class:cleric@xphb/cantrips' }),
        spell('spell:bless@xphb', 'class:cleric@xphb', {
          mode: 'prepared',
          choice: 'class:cleric@xphb/spells',
        }),
        spell('spell:bane@xphb', 'subclass:x', { mode: 'prepared' }),
        spell('spell:faerie fire@xphb', 'race:elf@xphb', {
          mode: 'innate',
          uses: { per: 'daily', count: 1 },
        }),
        spell('spell:hex@xphb', 'class:warlock@xphb', { mode: 'expanded' }),
        spell('spell:light@xphb', 'feat:x'),
      ],
      (k) => k.split(':')[1]?.split('@')[0] ?? k,
    );
    expect(rows.map((r) => [r.key.split(':')[1], r.from, r.how])).toEqual([
      ['light@xphb', 'cleric', 'Known'],
      ['bless@xphb', 'cleric', 'Prepared'],
      ['bane@xphb', 'x', 'Always prepared'],
      ['faerie fire@xphb', 'elf', '1/day'],
    ]);
  });
});
