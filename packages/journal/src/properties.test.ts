import { describe, expect, it } from 'vitest';
import { bannerOf, propertyKind, removeProperty, renameProperty, setProperty } from './properties';
import { applyTemplate, formatDate, templatePaths } from './templates';

const BOM = String.fromCharCode(0xfeff);
const note = '---\n# who she is\ntitle: Mother Tibia\ntype: npc\ntags:\n  - npc\n---\n# Body\n';

describe('properties', () => {
  it('sets a property and keeps comments, order and the body', () => {
    const out = setProperty(note, 'type', 'priestess');
    expect(out).toBe(
      '---\n# who she is\ntitle: Mother Tibia\ntype: priestess\ntags:\n  - npc\n---\n# Body\n',
    );
    expect(setProperty(note, 'level', 5)).toContain('tags:\n  - npc\nlevel: 5\n---\n# Body');
  });
  it('writes lists as block lists', () => {
    expect(setProperty(note, 'tags', ['npc', 'rustcrown'])).toContain(
      'tags:\n  - npc\n  - rustcrown\n',
    );
  });
  it('adds frontmatter to a note without any, and keeps a byte-order mark', () => {
    expect(setProperty('Body', 'type', 'npc')).toBe('---\ntype: npc\n---\nBody');
    expect(setProperty(BOM + '---\na: 1\n---\nBody', 'b', 2)).toBe(
      BOM + '---\na: 1\nb: 2\n---\nBody',
    );
  });
  it('removes and renames properties', () => {
    expect(removeProperty(note, 'type')).not.toContain('type:');
    expect(removeProperty('---\na: 1\n---\nBody', 'a')).toBe('Body');
    expect(renameProperty(note, 'type', 'kind')).toContain('title: Mother Tibia\nkind: npc\n');
  });
  it('refuses to rewrite invalid YAML', () => {
    expect(() => setProperty('---\n: [bad\n---\nBody', 'a', 1)).toThrow();
  });
  it('picks an editor per value', () => {
    expect([true, ['a'], 3, 'x', null].map(propertyKind)).toEqual([
      'boolean',
      'list',
      'number',
      'text',
      'text',
    ]);
  });
});

describe('banners', () => {
  it('reads banner, image or cover as a file link or a URL', () => {
    expect(bannerOf({ image: '[[RustcrownMap.png]]' })).toEqual({
      kind: 'file',
      target: 'RustcrownMap.png',
    });
    expect(bannerOf({ banner: '![[Assets/b.jpg|500]]' })).toEqual({
      kind: 'file',
      target: 'Assets/b.jpg',
    });
    expect(bannerOf({ cover: 'https://example.com/a.png' })?.kind).toBe('url');
    expect(bannerOf({ type: 'npc' })).toBeNull();
  });
});

describe('templates', () => {
  const now = new Date(2026, 9, 7, 9, 5);
  it('fills in title, date and time', () => {
    expect(applyTemplate('# {{title}}\n{{date}} {{time}}', { title: 'Session 3', now })).toBe(
      '# Session 3\n2026-10-07 09:05',
    );
    expect(applyTemplate('{{date:dddd D MMMM YYYY}}', { title: '', now })).toBe(
      'Wednesday 7 October 2026',
    );
  });
  it('formats with literals', () => {
    expect(formatDate(now, '[Day] D [of] MMM')).toBe('Day 7 of Oct');
  });
  it('finds notes in template folders', () => {
    expect(
      templatePaths(['Templates/NPC.md', '99_Templates_and_Databases/Session.md', 'NPCs/A.md']),
    ).toEqual(['Templates/NPC.md', '99_Templates_and_Databases/Session.md']);
  });
});
