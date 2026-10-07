import { describe, expect, it } from 'vitest';
import { filterPath, referencePath } from './referenceTarget';

describe('reference targets', () => {
  it('links books and adventures to the reader at a chapter and header', () => {
    expect(
      referencePath('book', ['Character Advancement table', 'XPHB', '2', 'Character Advancement']),
    ).toBe('/compendium/book/XPHB?ch=2&h=Character+Advancement');
    expect(referencePath('book', ['2014 version', 'PHB'])).toBe('/compendium/book/PHB');
    expect(referencePath('adventure', ['the Amber Temple', 'CoS', '13'])).toBe(
      '/compendium/adventure/CoS?ch=13',
    );
  });

  it('links the quick reference by chapter and name', () => {
    expect(referencePath('quickref', ['difficult terrain', '', '3'])).toBe(
      '/compendium/quickref/bookref-quick?ch=3&h=difficult+terrain',
    );
  });

  it('turns filter tags into list URLs', () => {
    expect(filterPath(['Common', 'items', 'rarity=Common'])).toBe(
      '/compendium/list/items?f.rarity=common',
    );
    expect(filterPath(['x', 'spells.html', 'level=1;2', 'class=wizard', 'school=V'])).toBe(
      '/compendium/list/spells?f.level=1%7E2&f.classes=Wizard&f.school=Evocation',
    );
    expect(filterPath(['x', 'unknown-page'])).toBe('/compendium');
  });
});
