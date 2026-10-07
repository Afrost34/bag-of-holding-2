import type { EntityDetail } from '@boh/data5e';
import { useEffect, useState } from 'react';
import { loadEntity } from '../data/entities';

/**
 * Entities by key, loaded together (cards, sheet pages). Mundane items referred to as `item:`
 * resolve to their `baseitem`.
 */
export function useEntities(keys: readonly string[]): {
  entities: Map<string, EntityDetail>;
  loaded: boolean;
} {
  const id = [...new Set(keys)].sort().join('\n');
  const [state, setState] = useState<{ for: string; map: Map<string, EntityDetail> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (id ? id.split('\n') : []).map(async (k) => {
        const e = (await loadEntity(k)) ?? (await loadEntity(k.replace(/^item:/, 'baseitem:')));
        return [k, e] as const;
      }),
    ).then((pairs) => {
      if (!cancelled)
        setState({
          for: id,
          map: new Map(
            pairs.filter((p): p is readonly [string, EntityDetail] => p[1] !== undefined),
          ),
        });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return { entities: state?.map ?? new Map<string, EntityDetail>(), loaded: state?.for === id };
}
