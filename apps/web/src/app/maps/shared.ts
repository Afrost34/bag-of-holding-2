/**
 * Map files keep what many items repeat only once. Every floor of a building carries the same
 * spec, and a town's buildings of one kind the same pictures and furniture (`palette`,
 * `furnish`, `broken`): a town of forty buildings would otherwise write the same choices a
 * hundred times. On writing, those values go into the file's `shared` table, each once, and the
 * items point at them (`{"$shared": key}`); on reading they are put back, the items sharing one
 * object. The rest of the app never sees the table. Pure.
 */

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The spec fields worth sharing between buildings, besides the spec itself between floors. */
const PARTS = ['palette', 'furnish', 'broken'] as const;

function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${h.toString(36)}${text.length.toString(36)}`;
}

/** The map as written: structure specs (and their pictures and furniture) put in `shared`. */
export function packShared<D extends { layers: readonly { items: readonly unknown[] }[] }>(
  doc: D,
): D & { shared?: Json } {
  const shared: Json = {};
  const texts = new Map<string, string>();
  const keyFor = (value: unknown): { $shared: string } => {
    const text = JSON.stringify(value);
    let key = hashOf(text);
    // Two different values with one hash: a suffix tells them apart.
    while (key in shared && texts.get(key) !== text) key = `${key}x`;
    shared[key] = value;
    texts.set(key, text);
    return { $shared: key };
  };
  const building = (item: unknown): item is Json & { spec: Json } =>
    isObj(item) && item.kind === 'structure' && isObj(item.spec);
  if (!doc.layers.some((l) => l.items.some(building))) return doc;
  const layers = doc.layers.map((layer) => ({
    ...layer,
    items: layer.items.map((item) => {
      if (!building(item)) return item;
      const spec: Json = { ...item.spec };
      for (const part of PARTS) if (spec[part] !== undefined) spec[part] = keyFor(spec[part]);
      return { ...item, spec: keyFor(spec) };
    }),
  }));
  return { ...doc, layers, shared };
}

/** The map as read: every `{"$shared": key}` replaced by its value (one object for all). */
export function unpackShared(json: unknown): unknown {
  if (!isObj(json) || !isObj(json.shared) || !Array.isArray(json.layers)) return json;
  const table = json.shared;
  const done = new Map<string, unknown>();
  const resolve = (v: unknown): unknown => {
    if (!isObj(v) || typeof v.$shared !== 'string') return v;
    const key = v.$shared;
    if (done.has(key)) return done.get(key);
    const raw = table[key];
    const value = isObj(raw)
      ? Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, resolve(x)]))
      : raw;
    done.set(key, value);
    return value;
  };
  const { shared: _shared, ...rest } = json;
  return {
    ...rest,
    layers: json.layers.map((layer: unknown) =>
      isObj(layer) && Array.isArray(layer.items)
        ? {
            ...layer,
            items: layer.items.map((item: unknown) =>
              isObj(item) && isObj(item.spec) ? { ...item, spec: resolve(item.spec) } : item,
            ),
          }
        : layer,
    ),
  };
}
