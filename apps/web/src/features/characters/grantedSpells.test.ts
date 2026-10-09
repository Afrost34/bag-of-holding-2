import type { AnsweredChoice } from '@boh/rules';
import { describe, expect, it } from 'vitest';
import { placeGranted } from './grantedSpells';

const list = (id: string, filter: string): AnsweredChoice => ({
  id,
  from: 'class:cleric@xphb',
  kind: 'spell',
  count: 3,
  label: '',
  picks: [],
  filter: { type: 'spell', filter },
});

describe('spells had anyway on the Spells tab', () => {
  const levels: Record<string, number> = { 'spell:light@xphb': 0, 'spell:bless@xphb': 1 };
  const levelOf = (k: string) => levels[k] ?? 0;
  const spells = [
    { key: 'spell:light@xphb', tag: 'Elf · Known' },
    { key: 'spell:bless@xphb', tag: 'Life Domain · Always prepared' },
    { key: 'spell:light@xphb', tag: 'Acolyte · Known' },
  ];

  it('puts cantrips with the cantrips and the rest with the levelled spells, once each', () => {
    const { grantedIn, unplaced } = placeGranted(
      spells,
      [list('cantrips', 'level=0|class=Cleric'), list('prepared', 'level=1;2|class=Cleric')],
      levelOf,
    );
    expect(grantedIn.get('cantrips')?.map((s) => s.tag)).toEqual(['Elf · Known']);
    expect(grantedIn.get('prepared')?.map((s) => s.key)).toEqual(['spell:bless@xphb']);
    expect(unplaced).toEqual([]);
  });

  it('keeps spells with no list of their level apart', () => {
    const { grantedIn, unplaced } = placeGranted(
      spells,
      [list('cantrips', 'level=0|class=Cleric')],
      levelOf,
    );
    expect(grantedIn.get('cantrips')).toHaveLength(1);
    expect(unplaced.map((s) => s.key)).toEqual(['spell:bless@xphb']);
  });
});
