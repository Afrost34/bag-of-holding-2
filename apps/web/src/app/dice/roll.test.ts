import { sequenceRng } from '@boh/dice';
import { describe, expect, it } from 'vitest';
import { needsFor, outcomeText, rollSpec, scaledExpression } from './roll';

const id = () => 'id';

describe('rollSpec', () => {
  it('rolls with advantage only when there is a d20', () => {
    const hit = rollSpec(
      { kind: 'd20', expression: '1d20 + 5', label: 'Scimitar' },
      'advantage',
      {},
      sequenceRng([3, 18]),
      id,
    );
    expect(hit).toMatchObject({ total: 23, mode: 'advantage', label: 'Scimitar' });
    const damage = rollSpec(
      { kind: 'damage', expression: '1d6 + 2' },
      'advantage',
      {},
      sequenceRng([4]),
      id,
    );
    expect(damage).toMatchObject({ total: 6, mode: 'normal' });
  });

  it('judges recharge and chance rolls', () => {
    const recharge = rollSpec(
      { kind: 'recharge', expression: '1d6', success: { atLeast: 5 } },
      'normal',
      {},
      sequenceRng([5]),
      id,
    );
    expect(outcomeText(recharge)).toBe('Recharged');
    const chance = rollSpec(
      { kind: 'chance', expression: '1d100', success: { atMost: 25 } },
      'normal',
      {},
      sequenceRng([40]),
      id,
    );
    expect(outcomeText(chance)).toBe('Failure');
    const coin = rollSpec({ kind: 'coin', expression: '1d2' }, 'normal', {}, sequenceRng([1]), id);
    expect(outcomeText(coin)).toBe('Heads');
  });

  it('rolls every alternative', () => {
    const r = rollSpec(
      { kind: 'dice', expression: 'd6;d8' },
      'normal',
      {},
      sequenceRng([2, 7]),
      id,
    );
    expect(r.total).toBe(2);
    expect(r.alternatives).toEqual([{ expression: 'd8', total: 7, breakdown: 'd8 → [7] = 7' }]);
  });
});

describe('inputs', () => {
  it('asks for variables and prompts without defaults', () => {
    expect(needsFor({ kind: 'damage', expression: '1d8 + summonSpellLevel' })).toEqual({
      variables: ['summonSpellLevel'],
      prompts: [],
    });
    expect(
      needsFor(
        { kind: 'damage', expression: '1d8 + summonSpellLevel' },
        { variables: { summonSpellLevel: 4 } },
      ),
    ).toBeNull();
    expect(
      needsFor({ kind: 'dice', expression: 'd20 + #$prompt_number:default=0,title=Bonus$#' }),
    ).toBeNull();
  });

  it('asks for a slot level and scales the dice', () => {
    const spec = {
      kind: 'damage' as const,
      expression: '1d8',
      scale: { base: '3d8', step: '1d8', minLevel: 3, maxLevel: 9 },
    };
    expect(needsFor(spec)).toEqual({
      variables: [],
      prompts: [],
      scale: { minLevel: 3, maxLevel: 9 },
    });
    expect(scaledExpression(spec.scale, 3)).toBe('3d8');
    expect(scaledExpression(spec.scale, 5)).toBe('3d8 + 2d8');
    expect(scaledExpression({ base: '10d6 + 40', step: '3d6', minLevel: 6, maxLevel: 9 }, 8)).toBe(
      '10d6 + 40 + 6d6',
    );
    const r = rollSpec(spec, 'normal', { level: 4 }, sequenceRng([1]), id);
    expect(r.expression).toBe('3d8 + 1d8');
  });
});
