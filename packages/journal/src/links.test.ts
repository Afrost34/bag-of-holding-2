import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  linkTargetFor,
  noteName,
  parseCompendiumRef,
  resolveLinkPath,
  updateLinksForRename,
} from './links';

const PATHS = [
  'Waterdeep.md',
  'Places/Neverwinter.md',
  'Places/Docks.md',
  'Sessions/Docks.md',
  'Sessions/Session 01.md',
  '_assets/map.png',
];

describe('compendium references', () => {
  it('maps note-style types to 5etools types', () => {
    expect(parseCompendiumRef('spell:Fireball@XPHB')).toEqual({
      type: 'spell',
      name: 'Fireball',
      source: 'XPHB',
    });
    expect(parseCompendiumRef('creature:Goblin')).toEqual({ type: 'monster', name: 'Goblin' });
    expect(parseCompendiumRef('Species:Elf')).toEqual({ type: 'race', name: 'Elf' });
  });

  it('leaves note names alone', () => {
    expect(parseCompendiumRef('Session 1: Arrival')).toBeNull();
    expect(parseCompendiumRef('Waterdeep')).toBeNull();
    expect(parseCompendiumRef('npc:Volo')).toBeNull();
  });
});

describe('note links', () => {
  it('resolves names, partial paths and attachments like Obsidian', () => {
    expect(resolveLinkPath('waterdeep', PATHS)).toBe('Waterdeep.md');
    expect(resolveLinkPath('Neverwinter', PATHS)).toBe('Places/Neverwinter.md');
    expect(resolveLinkPath('Places/Neverwinter.md', PATHS)).toBe('Places/Neverwinter.md');
    expect(resolveLinkPath('map.png', PATHS)).toBe('_assets/map.png');
    expect(resolveLinkPath('Baldur', PATHS)).toBeNull();
    // Ambiguous names prefer the linking note's folder, then the shortest path.
    expect(resolveLinkPath('Docks', PATHS, 'Sessions/Session 01.md')).toBe('Sessions/Docks.md');
    expect(resolveLinkPath('Docks', PATHS, 'Waterdeep.md')).toBe('Places/Docks.md');
  });

  it('writes the shortest unambiguous target', () => {
    expect(noteName('Places/Neverwinter.md')).toBe('Neverwinter');
    expect(linkTargetFor('Places/Neverwinter.md', PATHS)).toBe('Neverwinter');
    expect(linkTargetFor('Places/Docks.md', PATHS)).toBe('Places/Docks');
  });

  it('indexes backlinks and unresolved links', () => {
    const notes = new Map([
      ['Waterdeep.md', 'See [[Neverwinter]] and [[spell:Fireball]] and [[Baldur]].'],
      ['Places/Neverwinter.md', 'Back to [[Waterdeep|the city]].'],
    ]);
    const index = buildIndex(notes);
    expect(index.backlinks.get('Places/Neverwinter.md')?.map((b) => b.from)).toEqual([
      'Waterdeep.md',
    ]);
    expect(index.backlinks.get('Waterdeep.md')?.[0]?.link.display).toBe('the city');
    expect(index.unresolved.map((u) => u.link.target)).toEqual(['Baldur']);
  });

  it('updates links when a note is renamed or moved', () => {
    const before = ['A.md', 'Places/Neverwinter.md'];
    const after = ['A.md', 'Cities/Neverwinter City.md'];
    const text = 'Go to [[Neverwinter#Docks|the docks]], ![[Neverwinter]] and [[Other]].';
    expect(
      updateLinksForRename(
        text,
        'A.md',
        'Places/Neverwinter.md',
        'Cities/Neverwinter City.md',
        before,
        after,
      ),
    ).toBe('Go to [[Neverwinter City#Docks|the docks]], ![[Neverwinter City]] and [[Other]].');
  });
});
