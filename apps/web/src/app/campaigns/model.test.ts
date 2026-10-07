import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  newCampaign,
  parseCampaign,
  parseTemplate,
  serializeCampaign,
  serializeTemplate,
  slugify,
  templateFromCampaign,
} from './model';

const NOW = '2026-10-07T12:00:00.000Z';
const t2014 = BUILT_IN_TEMPLATES.find((t) => t.edition === '2014');
const t2024 = BUILT_IN_TEMPLATES.find((t) => t.edition === '2024');

describe('campaigns', () => {
  it('makes folder-safe, unique ids', () => {
    expect(slugify('Rust & Sunfire', [])).toBe('rust-sunfire');
    expect(slugify('Rust & Sunfire', ['rust-sunfire'])).toBe('rust-sunfire-2');
    expect(slugify('Élan Vital!', [])).toBe('elan-vital');
    expect(slugify('***', [])).toBe('campaign');
  });

  it('creates a campaign from a template', () => {
    if (!t2014 || !t2024) throw new Error('templates missing');
    const c = newCampaign('Old School', t2014, [], NOW);
    expect(c).toMatchObject({ id: 'old-school', name: 'Old School', edition: '2014' });
    expect(c.sources).toEqual({ xphb: false, xdmg: false, xmm: false });
    // The template is copied, not shared.
    c.sources.phb = false;
    expect(t2014.sources).not.toHaveProperty('phb');
    expect(newCampaign('Rust & Sunfire', t2024, [], NOW).sources).toEqual({});
  });

  it('round-trips campaigns and templates, tolerating bad fields', () => {
    if (!t2024) throw new Error('template missing');
    const c = newCampaign('Rust & Sunfire', t2024, [], NOW);
    expect(parseCampaign(serializeCampaign(c), c.id)).toEqual(c);
    expect(
      parseCampaign(
        '{"name":"X","edition":"1999","sources":{"PHB":false,"a":1},"rules":{"encumbrance":"heavy"}}',
        'x',
      ),
    ).toMatchObject({
      name: 'X',
      edition: '2024',
      sources: { phb: false },
      rules: { encumbrance: 'off', optionalClassFeatures: true },
    });
    expect(parseCampaign('nope', 'x')).toBeNull();
    const t = templateFromCampaign(c, 'My table', []);
    expect(parseTemplate(serializeTemplate(t), t.id)).toEqual(t);
  });
});
