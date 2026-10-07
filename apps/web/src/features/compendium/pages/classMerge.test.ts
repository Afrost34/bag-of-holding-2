import type { FeatureEntry } from '@boh/data5e';
import { describe, expect, it } from 'vitest';
import { isSubclassPlaceholder, mergeFeatures } from './classMerge';

const f = (level: number, name: string, gainSubclass = false): FeatureEntry => ({
  key: `${name}@${String(level)}`,
  name,
  level,
  gainSubclass,
});

describe('class and subclass features', () => {
  it('recognises placeholders in both editions', () => {
    expect(isSubclassPlaceholder('Subclass Feature', 'Fighter Subclass')).toBe(true);
    expect(isSubclassPlaceholder('Arcane Tradition feature', 'Arcane Tradition')).toBe(true);
    expect(isSubclassPlaceholder('Path feature', 'Primal Path')).toBe(true);
    expect(isSubclassPlaceholder('Arcane Recovery', 'Arcane Tradition')).toBe(false);
    expect(isSubclassPlaceholder('Aura improvements', 'Sacred Oath')).toBe(false);
  });

  it('merges by level and replaces placeholders the subclass fills', () => {
    const cls = [
      f(1, 'Second Wind'),
      f(3, 'Fighter Subclass', true),
      f(7, 'Subclass Feature'),
      f(9, 'Indomitable'),
      f(10, 'Subclass Feature'),
    ];
    const sub = [f(3, 'Champion'), f(3, 'Improved Critical'), f(7, 'Remarkable Athlete')];
    const merged = mergeFeatures(cls, sub, 'Fighter Subclass');
    expect(merged.map((m) => [m.feature.level, m.feature.name, m.from])).toEqual([
      [1, 'Second Wind', 'class'],
      [3, 'Fighter Subclass', 'class'],
      [3, 'Champion', 'subclass'],
      [3, 'Improved Critical', 'subclass'],
      [7, 'Remarkable Athlete', 'subclass'],
      [9, 'Indomitable', 'class'],
      // No subclass feature at 10 here: the placeholder stays.
      [10, 'Subclass Feature', 'class'],
    ]);
  });

  it('leaves the class alone without a subclass', () => {
    const cls = [f(1, 'Rage'), f(6, 'Primal Path feature')];
    expect(mergeFeatures(cls, [], 'Primal Path').map((m) => m.feature.name)).toEqual([
      'Rage',
      'Primal Path feature',
    ]);
  });
});
