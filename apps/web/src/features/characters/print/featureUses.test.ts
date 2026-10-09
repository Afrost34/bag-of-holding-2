import { describe, expect, it } from 'vitest';
import { featureUses, type UsesContext } from './featureUses';

const ctx: UsesContext = {
  proficiencyBonus: 3,
  modifiers: { charisma: 4, wisdom: 0 },
  classTable: [
    { label: 'Rages', value: '3' },
    { label: 'Wild Shape', value: '2' },
  ],
};

describe('feature uses', () => {
  it('reads the class table, then the text', () => {
    expect(
      featureUses('Rage', 'You regain all expended uses when you finish a Long Rest.', ctx),
    ).toEqual({ count: 3, per: 'Long Rest' });
    expect(
      featureUses(
        'Lucky',
        'You have a number of Luck Points equal to your Proficiency Bonus… you regain them when you finish a Long Rest. You can use it a number of times equal to your Proficiency Bonus.',
        ctx,
      ),
    ).toEqual({ count: 3, per: 'Long Rest' });
    expect(
      featureUses(
        'Bardic Inspiration',
        'You can do so a number of times equal to your Charisma modifier (minimum of once). You regain all expended uses when you finish a Long Rest.',
        ctx,
      ),
    ).toEqual({ count: 4, per: 'Long Rest' });
    expect(
      featureUses(
        'Second Wind',
        'Once you use this feature, you must finish a Short or Long Rest before you can use it again.',
        ctx,
      ),
    ).toEqual({ count: 1, per: 'Short or Long Rest' });
    expect(
      featureUses(
        'Relentless Endurance',
        "You can't use this feature again until you finish a Long Rest.",
        ctx,
      ),
    ).toEqual({ count: 1, per: 'Long Rest' });
  });

  it('gives no boxes to features that do not recharge', () => {
    expect(featureUses('Darkvision', 'You can see in dim light within 60 feet.', ctx)).toBeNull();
    expect(
      featureUses('Ability Score Improvement', 'Increase one score by 2 once.', ctx),
    ).toBeNull();
  });
});
