import { describe, expect, it } from 'vitest';
import { packSummary } from './packs';

describe('packSummary', () => {
  it('counts each kind, in plain English', () => {
    expect(packSummary([])).toBe('Empty');
    expect(
      packSummary([
        { type: 'class' },
        { type: 'class' },
        { type: 'race' },
        { type: 'race' },
        { type: 'monster' },
      ]),
    ).toBe('2 classes, 2 species, 1 monster');
  });
});
