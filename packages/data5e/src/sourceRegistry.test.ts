import { describe, expect, it } from 'vitest';
import { parseSourceRegistry } from './sourceRegistry';

const SAMPLE = `
Parser.SRC_PHB = "PHB";
Parser.SRC_PS_PREFIX = "PS";
Parser.SRC_PSA = \`\${Parser.SRC_PS_PREFIX}A\`;
Parser.SRC_DrDe = "DrDe";
Parser.SRC_DrDe_BD = "DrDe-BD"; // a comment
Parser.TftYP_NAME = "Tales from the Yawning Portal";
Parser.SRC_TYP_AtG = "TftYP-AtG";
Parser.SOURCE_JSON_TO_FULL = {};
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_PHB] = "Player's Handbook (2014)";
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_PSA] = 'Plane Shift: Amonkhet';
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_TYP_AtG] = \`\${Parser.TftYP_NAME}: Against the Giants\`;
Parser.SOURCE_JSON_TO_ABV[Parser.SRC_PSA] = "PSA";
Parser.SOURCE_JSON_TO_DATE[Parser.SRC_DrDe] = "2025-07-08";
Parser.SOURCE_JSON_TO_DATE[Parser.SRC_DrDe_BD] = Parser.SOURCE_JSON_TO_DATE[Parser.SRC_DrDe];
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_UNKNOWN] = "ignored";
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_PHB] = someFunction();
`;

describe('parseSourceRegistry', () => {
  const registry = parseSourceRegistry(SAMPLE);

  it('reads literal, template and concatenated names', () => {
    expect(registry.get('PHB')?.full).toBe("Player's Handbook (2014)");
    expect(registry.get('PSA')).toEqual({ full: 'Plane Shift: Amonkhet', abbreviation: 'PSA' });
    expect(registry.get('TftYP-AtG')?.full).toBe(
      'Tales from the Yawning Portal: Against the Giants',
    );
  });

  it('follows references to other map entries', () => {
    expect(registry.get('DrDe-BD')?.date).toBe('2025-07-08');
  });

  it('skips statements it cannot evaluate', () => {
    expect([...registry.keys()].sort()).toEqual(['DrDe', 'DrDe-BD', 'PHB', 'PSA', 'TftYP-AtG']);
  });
});
