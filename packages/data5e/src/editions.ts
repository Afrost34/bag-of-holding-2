/**
 * 2014 ("classic") vs 2024 ("one") rules. Mirrors 5etools' own rule: a source is classic when it
 * was published before the 2024 Player's Handbook. An explicit `edition` field on an entity wins.
 */

export type Edition = '2014' | '2024';

/** Publication date of the 2024 Player's Handbook (XPHB). */
export const EDITION_2024_START = '2024-09-17';

export function editionFromDate(published: string | undefined): Edition | undefined {
  if (published === undefined || published === '') return undefined;
  return published < EDITION_2024_START ? '2014' : '2024';
}

export function editionFromField(value: unknown): Edition | undefined {
  if (value === 'one') return '2024';
  if (value === 'classic') return '2014';
  return undefined;
}

/**
 * Entity edition: explicit field, then the 2024-only SRD/basic-rules flags, then the source's
 * edition, then 2014 as a last resort (sources with no known date are almost all older material).
 */
export function entityEdition(
  entity: Record<string, unknown>,
  sourceEdition: Edition | undefined,
): Edition {
  return (
    editionFromField(entity.edition) ??
    (entity.srd52 === true || entity.basicRules2024 === true ? '2024' : undefined) ??
    sourceEdition ??
    '2014'
  );
}
