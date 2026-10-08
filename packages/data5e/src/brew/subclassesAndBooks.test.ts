import { describe, expect, it } from 'vitest';
import { bookToForm, formToBook } from './books';
import { formToClass, formToSubclass, subclassToForm } from './characterOptions';
import {
  bookDataOf,
  newPack,
  putBook,
  putSubclass,
  removeBook,
  removeSubclass,
  subclassFeatures,
} from './pack';
import { richEntries, richText } from './text';

const meta = { id: 'GS', name: 'Gunslinger', edition: '2024' as const, author: '' };
const table = { type: 'table', colLabels: ['d100', 'Item'], rows: [['01-15', 'Daggers']] };

describe('text with tables and lists', () => {
  it('keeps them exactly when the text is left alone, and after the text when it changes', () => {
    const entries = ['Roll on the table.', table];
    const form = richText(entries);
    expect(form.text).toBe('Roll on the table.');
    expect(richEntries(form)).toBe(entries);
    expect(richEntries({ ...form, text: 'Roll once.' })).toEqual(['Roll once.', table]);
    expect(richText(['Plain.'])).toEqual({ text: 'Plain.' });
  });

  it('a class edited in the form keeps its tools, fixed skills and rich features', () => {
    const base = {
      name: 'Gunslinger',
      startingProficiencies: {
        tools: ['gunnery kit'],
        skills: [{ intimidation: true, choose: { from: ['athletics', 'insight'], count: 1 } }],
      },
    };
    const { cls, features } = formToClass(
      {
        name: 'Gunslinger',
        hitDie: 10,
        primary: 'cha',
        saves: ['con', 'cha'],
        armor: ['light'],
        weapons: ['simple', 'firearms'],
        skillsFrom: ['athletics', 'insight'],
        skillCount: 1,
        caster: 'none',
        spellAbility: 'int',
        spellList: '',
        subclassTitle: 'Persona',
        features: [{ level: 1, name: 'Menace', ...richText(['Drop it!', table]) }],
      },
      '2024',
      'GS',
      base,
    );
    expect(cls.startingProficiencies).toMatchObject(base.startingProficiencies);
    expect(features[0]?.entries).toEqual(['Drop it!', table]);
  });
});

describe('homebrew subclasses', () => {
  it('belong to any class, official or not, and their features follow a rename', () => {
    const form = {
      name: 'Desperado',
      shortName: 'Desperado',
      className: 'Rogue',
      classSource: 'XPHB',
      caster: false,
      spellAbility: 'int' as const,
      features: [{ level: 3, name: 'Shoot First', text: 'Draw on initiative.' }],
    };
    const { subclass, features } = formToSubclass(form, '2024', 'GS');
    expect(subclass).toMatchObject({
      shortName: 'Desperado',
      className: 'Rogue',
      classSource: 'XPHB',
      edition: 'one',
      subclassFeatures: ['Shoot First|Rogue|XPHB|Desperado|GS|3'],
    });
    expect(features[0]).toMatchObject({
      subclassShortName: 'Desperado',
      subclassSource: 'GS',
      level: 3,
    });
    expect(subclassToForm(subclass, features)).toEqual(form);

    let pack = putSubclass(newPack(meta), subclass, features);
    const renamed = formToSubclass({ ...form, name: 'Outlaw', shortName: 'Outlaw' }, '2024', 'GS');
    pack = putSubclass(pack, renamed.subclass, renamed.features, 'Desperado');
    expect(subclassFeatures(pack, subclass)).toEqual([]);
    expect(subclassFeatures(pack, renamed.subclass).map((f) => f.name)).toEqual(['Shoot First']);
    pack = removeSubclass(pack, 'Outlaw');
    expect(pack.subclass).toBeUndefined();
    expect(pack.subclassFeature).toBeUndefined();
  });
});

describe('homebrew books', () => {
  it('are chapters of sections, with a table of contents, and read back', () => {
    const form = {
      name: 'Blackpowder',
      id: '',
      description: 'How firearms work',
      author: 'David Adams',
      chapters: [
        {
          name: 'Firearms',
          text: 'All firearms use blackpowder.',
          sections: [
            { name: 'Reloading', text: 'Takes five minutes.' },
            { name: '', ...richText([table]) },
          ],
        },
      ],
    };
    const { book, bookData } = formToBook(form, 'GS');
    expect(book).toMatchObject({
      id: 'Blackpowder',
      source: 'GS',
      contents: [{ name: 'Firearms', headers: ['Reloading'] }],
    });
    expect(bookData.data).toEqual([
      {
        type: 'section',
        name: 'Firearms',
        entries: [
          'All firearms use blackpowder.',
          { type: 'entries', name: 'Reloading', entries: ['Takes five minutes.'] },
          table,
        ],
      },
    ]);
    const back = bookToForm(book, bookData);
    expect(back.chapters[0]?.sections.map((s) => s.name)).toEqual(['Reloading', '']);
    expect(formToBook(back, 'GS').bookData).toEqual(bookData);

    let pack = putBook(newPack(meta), book, bookData);
    expect(bookDataOf(pack, 'blackpowder')?.source).toBe('GS');
    pack = removeBook(pack, 'Blackpowder');
    expect(pack.book).toBeUndefined();
    expect(pack.bookData).toBeUndefined();
  });
});
