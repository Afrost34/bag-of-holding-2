import type { AnsweredChoice } from '@boh/rules';
import { describe, expect, it } from 'vitest';
import { choicesFor, isAbilityIncrease, slotsFrom } from './increaseModel';

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
