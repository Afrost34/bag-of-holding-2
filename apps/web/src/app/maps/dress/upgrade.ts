/**
 * Scatters saved before dressings had rules kept their one rule's settings on the item itself
 * (`pieces`, `spacing`…). This moves them into `rules` (a `DressRule`, see `model.ts`) so old maps
 * open looking the same. Pure; an item that already has rules, or is not a scatter, comes back as
 * it was. It knows the item only by its `kind`, so `model.ts` can use it without a cycle.
 */
export function upgradeScatter<T extends { kind: string }>(item: T): T {
  if (item.kind !== 'scatter') return item;
  const raw = item as unknown as Record<string, unknown>;
  if (Array.isArray(raw.rules)) return item;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const rotation = raw.rotation;
  const sides = raw.sides;
  const rule = {
    place: raw.mode === 'along' ? 'along' : 'area',
    pieces: Array.isArray(raw.pieces)
      ? raw.pieces.flatMap((p: unknown) => {
          if (typeof p !== 'object' || p === null) return [];
          const piece = p as Record<string, unknown>;
          return typeof piece.ref === 'string'
            ? [{ ref: piece.ref, weight: num(piece.weight, 1) }]
            : [];
        })
      : [],
    spacing: num(raw.spacing, 40),
    sizeMin: num(raw.sizeMin, 30),
    sizeMax: num(raw.sizeMax, 50),
    rotation:
      rotation === 'random' || rotation === 'along' || rotation === 'quarter' ? rotation : 'none',
    ...(typeof raw.rotMin === 'number' ? { rotMin: raw.rotMin } : {}),
    ...(typeof raw.rotMax === 'number' ? { rotMax: raw.rotMax } : {}),
    ...(typeof raw.overlap === 'number' && raw.overlap > 0 ? { overlap: raw.overlap } : {}),
    cluster: num(raw.cluster, 0),
    offset: num(raw.offset, 0),
    sides: sides === 'both' || sides === 'left' || sides === 'right' ? sides : 'center',
    jitter: num(raw.jitter, 0),
  };
  const {
    pieces: _p,
    spacing: _s,
    sizeMin: _a,
    sizeMax: _b,
    rotation: _r,
    rotMin: _r0,
    rotMax: _r1,
    overlap: _o,
    cluster: _c,
    offset: _f,
    sides: _d,
    jitter: _j,
    ...rest
  } = raw;
  return { ...rest, rules: [rule] } as unknown as T;
}
