import { describe, expect, it } from 'vitest';
import { isAsiChoice, offCategoryFeatWarning } from './featWarning';

describe('offCategoryFeatWarning', () => {
  it('says nothing for General feats or feats without a category', () => {
    expect(offCategoryFeatWarning({ category: 'G' })).toBeNull();
    expect(offCategoryFeatWarning({})).toBeNull();
  });

  it('warns about other kinds of feat and asks for the DM', () => {
    const text = offCategoryFeatWarning({ category: 'D' });
    expect(text).toContain('a Dragonmark feat');
    expect(text).toContain('only if your DM allows');
    expect(text).not.toContain('prerequisites');
  });

  it('mentions prerequisites when the feat has some', () => {
    const text = offCategoryFeatWarning({
      category: 'EB',
      prerequisite: [{ level: 19 }],
    });
    expect(text).toContain('an Epic Boon feat');
    expect(text).toContain('prerequisites');
  });
});

describe('isAsiChoice', () => {
  it('recognises the 2024 Ability Score Improvement choice', () => {
    expect(isAsiChoice('classfeature:ability score improvement|druid|xphb|4@xphb/feats')).toBe(
      true,
    );
    expect(isAsiChoice('feat:skilled@xphb/skillToolLanguage')).toBe(false);
  });
});
