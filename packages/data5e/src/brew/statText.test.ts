import { describe, expect, it } from 'vitest';
import { tagStatText, untagStatText } from './statText';

describe('statblock text', () => {
  it('tags a 2014 attack, and reads it back', () => {
    const plain =
      'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage. The target must succeed on a DC 13 Constitution saving throw or be poisoned.';
    const tagged = tagStatText(plain);
    expect(tagged).toBe(
      '{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage. The target must succeed on a {@dc 13} Constitution saving throw or be {@condition poisoned}.',
    );
    expect(untagStatText(tagged)).toBe(plain);
  });

  it('tags a 2024 attack', () => {
    const tagged = tagStatText(
      'Ranged Attack Roll: +5, range 80/320 ft. Hit: 6 (1d6 + 3) Piercing damage.',
    );
    expect(tagged).toBe(
      '{@atkr r} {@hit 5}, range 80/320 ft. {@h}6 ({@damage 1d6 + 3}) Piercing damage.',
    );
    expect(untagStatText(tagged)).toBe(
      'Ranged Attack Roll: +5, range 80/320 ft. Hit: 6 (1d6 + 3) Piercing damage.',
    );
  });

  it('leaves tags it finds alone', () => {
    expect(tagStatText('Casts {@spell fireball} and knocks it {@condition prone}.')).toBe(
      'Casts {@spell fireball} and knocks it {@condition prone}.',
    );
    expect(untagStatText('{@recharge 5}')).toBe('(Recharge 5–6)');
  });
});
