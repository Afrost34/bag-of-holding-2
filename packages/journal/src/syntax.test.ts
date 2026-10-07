import { describe, expect, it } from 'vitest';
import {
  noteSection,
  noteTags,
  parseFrontmatter,
  parseLinkInner,
  parseTags,
  parseWikiLinks,
} from './syntax';

describe('wikilinks', () => {
  it('parses targets, headings, blocks, display text and embeds', () => {
    const text = 'See [[Waterdeep]], [[Places/Neverwinter#Docks|the docks]] and ![[map.png]].';
    expect(parseWikiLinks(text).map(({ start: _s, end: _e, ...l }) => l)).toEqual([
      { target: 'Waterdeep', embed: false },
      { target: 'Places/Neverwinter', heading: 'Docks', display: 'the docks', embed: false },
      { target: 'map.png', embed: true },
    ]);
    expect(parseLinkInner('Note#^abc123')).toEqual({ target: 'Note', block: 'abc123' });
    expect(parseLinkInner('spell:Fireball@XPHB\\|boom')).toEqual({
      target: 'spell:Fireball@XPHB',
      display: 'boom',
    });
  });

  it('reports offsets and ignores code', () => {
    const text = 'a [[One]] `[[Two]]`\n```\n[[Three]]\n```\n[[Four]]';
    const links = parseWikiLinks(text);
    expect(links.map((l) => l.target)).toEqual(['One', 'Four']);
    expect(text.slice(links[0]?.start, links[0]?.end)).toBe('[[One]]');
  });
});

describe('tags', () => {
  it('finds tags but not headings, numbers, urls or code', () => {
    const text =
      '# Heading\n#npc and #faction/zhentarim, issue #42, https://x.y/#frag, `#code`, C#';
    expect(parseTags(text)).toEqual(['npc', 'faction/zhentarim']);
  });

  it('merges frontmatter tags', () => {
    expect(noteTags('---\ntags: [villain, "#npc"]\n---\nA #villain in #waterdeep')).toEqual([
      'villain',
      'npc',
      'waterdeep',
    ]);
    expect(noteTags('---\ntags:\n  - place\n---\n')).toEqual(['place']);
  });
});

const BOM = String.fromCharCode(0xfeff);

describe('frontmatter', () => {
  it('parses YAML and finds where the body starts', () => {
    const text = '---\nstatus: alive\nlevel: 5\n---\nBody';
    const fm = parseFrontmatter(text);
    expect(fm.data).toEqual({ status: 'alive', level: 5 });
    expect(text.slice(fm.bodyStart)).toBe('Body');
    expect(parseFrontmatter('No frontmatter')).toEqual({ data: {}, bodyStart: 0 });
    expect(parseFrontmatter(BOM + '---\ntype: npc\n---\n').data).toEqual({ type: 'npc' });
    expect(parseFrontmatter('---\n: [bad\n---\n').error).toBeDefined();
  });
});

describe('noteSection', () => {
  const note =
    '---\ntags: [city]\n---\n# Waterdeep\nIntro\n## Wards\nDock Ward\n### Taverns\nYawning Portal\n## People\nLaeral';
  it('drops frontmatter', () => {
    expect(noteSection(note)?.startsWith('# Waterdeep')).toBe(true);
  });
  it('returns a heading and its subsections, up to the next heading of its level', () => {
    expect(noteSection(note, 'wards')).toBe('## Wards\nDock Ward\n### Taverns\nYawning Portal');
    expect(noteSection(note, 'People')).toBe('## People\nLaeral');
  });
  it('returns null for a missing heading', () => {
    expect(noteSection(note, 'Nope')).toBeNull();
  });
});
