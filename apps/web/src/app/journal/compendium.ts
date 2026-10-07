import type { EntitySummary } from '@boh/data5e';
import type { CompendiumRef } from '@boh/journal';
import type { CampaignEdition } from '../campaigns/model';
import { dataWorker } from '../data/client';

/**
 * Compendium links in notes: `[[spell:Fireball@XPHB]]`, `[[creature:Goblin]]`. Without a source,
 * the campaign's edition decides which version opens (2014 campaigns prefer 2014 printings).
 */

/** 5etools types written with friendlier names in notes. */
const NOTE_TYPE: Record<string, string> = {
  monster: 'creature',
  race: 'species',
  variantrule: 'rule',
  optionalfeature: 'option',
};

/** How an entity is written in a note: `creature:Goblin@XMM`. */
export function noteRefFor(entity: Pick<EntitySummary, 'type' | 'name' | 'source'>): string {
  return `${NOTE_TYPE[entity.type] ?? entity.type}:${entity.name}@${entity.source}`;
}

const cache = new Map<string, Promise<string | null>>();

export function clearCompendiumRefCache(): void {
  cache.clear();
}

/** The entity key a compendium link opens, or null when it is not in the data. */
export function resolveCompendiumRef(
  ref: CompendiumRef,
  edition: CampaignEdition = '2024',
): Promise<string | null> {
  const cacheKey = `${ref.type}|${ref.name}|${ref.source ?? ''}|${edition}`.toLowerCase();
  let promise = cache.get(cacheKey);
  if (!promise) {
    promise = dataWorker()
      .search(ref.name, { types: [ref.type], limit: 40 })
      .then((results) => {
        const name = ref.name.toLowerCase();
        const exact = results.filter((r) => r.name.toLowerCase() === name);
        if (ref.source) {
          const source = ref.source.toLowerCase();
          return exact.find((r) => r.source.toLowerCase() === source)?.key ?? null;
        }
        const preferred = edition === '2014' ? '2014' : '2024';
        const sorted = [...exact].sort(
          (a, b) => Number(b.edition === preferred) - Number(a.edition === preferred),
        );
        return sorted[0]?.key ?? null;
      })
      .catch(() => null);
    cache.set(cacheKey, promise);
  }
  return promise;
}
