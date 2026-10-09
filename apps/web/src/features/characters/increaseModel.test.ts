import type { AnsweredChoice } from '@boh/rules';
import { describe, expect, it } from 'vitest';
import {
  choicesFor,
  increaseOf,
  isAbilityIncrease,
  otherFor,
  slotsFrom,
  withoutIncreaseParts,
} from './increaseModel';

const id = 'background:charlatan@xphb/ability';
const ability = (n: string, amounts: number[]) => ({
  id: `${id}/${n}`,
  kind: 'ability' as const,
  count: amounts.length,
  label: '',
  options: ['dex', 'con', 'cha'],
  amounts,
});
const choice: AnsweredChoice = {
  id,
  from: 'background:charlatan@xphb',
  kind: 'alternative',
  count: 1,
  label: '',
  picks: [],
  options: ['0', '1'],
  branches: [
    { id: '0', label: '+2/+1', grants: [], choices: [ability('0', [2, 1])] },
    { id: '1', label: '+1/+1/+1', grants: [], choices: [ability('1', [1, 1, 1])] },
  ],
};

describe('three +1 picks', () => {
  it('recognises the background increase', () => {
    expect(isAbilityIncrease(choice)).toBe(true);
  });

  it('picks the +2/+1 bundle when an ability is chosen twice', () => {
    const next = choicesFor(choice, {}, ['cha', 'dex', 'cha']);
    expect(next).toEqual({ [id]: ['0'], [`${id}/0`]: ['cha', 'dex'] });
    expect(slotsFrom(choice, next)).toEqual(['cha', 'cha', 'dex']);
  });

  it('picks +1/+1/+1 for three different abilities, and nothing while incomplete or invalid', () => {
    expect(choicesFor(choice, {}, ['dex', 'con', 'cha'])).toEqual({
      [id]: ['1'],
      [`${id}/1`]: ['dex', 'con', 'cha'],
    });
    expect(choicesFor(choice, { [id]: ['1'], other: ['x'] }, ['dex', '', 'cha'])).toEqual({
      other: ['x'],
    });
    expect(choicesFor(choice, {}, ['dex', 'dex', 'dex'])).toEqual({});
  });
});

describe('two +1 picks (Ability Score Improvement)', () => {
  const asi = 'classfeature:asi/asi';
  const inner = (n: string, amounts: number[]) => ({
    id: `classfeature:asi/ability/${n}`,
    kind: 'ability' as const,
    count: amounts.length,
    label: '',
    options: ['str', 'dex', 'con'],
    amounts,
  });
  const improvement: AnsweredChoice = {
    id: asi,
    from: 'class:fighter@phb',
    kind: 'alternative',
    count: 1,
    label: '',
    picks: [],
    options: ['plus2', 'plus1', 'feat'],
    branches: [
      { id: 'plus2', label: '+2', grants: [], choices: [inner('0', [2])] },
      { id: 'plus1', label: '+1/+1', grants: [], choices: [inner('1', [1, 1])] },
      { id: 'feat', label: 'A feat', grants: [], choices: [] },
    ],
  };

  it('is two dropdowns, with the feat as another way', () => {
    expect(increaseOf(improvement)).toMatchObject({ slots: 2, others: [{ id: 'feat' }] });
    expect(withoutIncreaseParts([improvement, { ...improvement, ...inner('0', [2]) }])).toEqual([
      improvement,
    ]);
  });

  it('gives +2 for the same ability twice and +1/+1 for two', () => {
    const twice = choicesFor(improvement, {}, ['str', 'str']);
    expect(twice).toEqual({ [asi]: ['plus2'], 'classfeature:asi/ability/0': ['str'] });
    expect(slotsFrom(improvement, twice)).toEqual(['str', 'str']);
    const two = choicesFor(improvement, twice, ['str', 'dex']);
    expect(two).toEqual({ [asi]: ['plus1'], 'classfeature:asi/ability/1': ['str', 'dex'] });
    expect(otherFor(improvement, two, 'feat')).toEqual({ [asi]: ['feat'] });
  });
});
