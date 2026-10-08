import type { EntityDetail } from '@boh/data5e';
import { Entries } from '@boh/renderer';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CharacterFile } from '../../../app/characters/model';
import { usePacking, type Packing, type PackItem } from '../../../app/cards/packing';
import { PrintCard } from '../../../app/cards/PrintCard';
import { loadEntity } from '../../../app/data/entities';
import type { CharacterView } from '../../../app/data/protocol';
import { FeatureCard, SaveLine } from './PrintCards';
import { asksOnly, lineageTrait, withoutReferences } from './featureCards';
import { ORDINAL, sourceLabel } from './printText';
import type { PrintSection } from './sections';

/**
 * What the printed sheet needs beyond the character: the spells, features, items and species
 * in full, and the cards packed into A4 pages. Worked out once for the preview and the print copy
 * (which is hidden on screen, so it cannot measure its cards itself).
 */
export interface PrintData {
  entities: Map<string, EntityDetail>;
  /** Known spells, by level then name. */
  spells: EntityDetail[];
  /** The features the sheet lists (not those that only ask for a choice). */
  features: CharacterView['features'];
  cards: readonly PackItem[];
  packing: Packing;
  /** Off-screen copy of the cards that measures them; render it once, on screen. */
  measurer: ReactNode;
}

/** Entities the sheet shows in full (spells, features, items, species), loaded once. */
function useEntities(keys: readonly string[]): Map<string, EntityDetail> {
  const [map, setMap] = useState(new Map<string, EntityDetail>());
  const id = [...new Set(keys)].sort().join('\n');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (id ? id.split('\n') : []).map(async (k) => {
        const e = (await loadEntity(k)) ?? (await loadEntity(k.replace(/^item:/, 'baseitem:')));
        return [k, e] as const;
      }),
    ).then((pairs) => {
      if (!cancelled)
        setMap(
          new Map(pairs.filter((p): p is readonly [string, EntityDetail] => p[1] !== undefined)),
        );
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return map;
}

export function usePrintData(
  character: CharacterFile | undefined,
  view: CharacterView | undefined,
  hidden: readonly PrintSection[],
): PrintData {
  const spellKeys = view
    ? [...new Set(view.grants.flatMap((g) => (g.kind === 'spell' ? [g.key] : [])))]
    : [];
  const featureKeys = view
    ? view.features.filter((f) => !f.key.includes('#')).map((f) => f.key)
    : [];
  const itemKeys = (character?.decisions.inventory ?? []).map((i) => i.key).filter(Boolean);
  const speciesKeys = view
    ? view.entities.filter((e) => e.type === 'race' || e.type === 'subrace').map((e) => e.key)
    : [];
  const entities = useEntities([...spellKeys, ...featureKeys, ...itemKeys, ...speciesKeys]);
  const spellId = spellKeys.join('|');
  const spells = useMemo(
    () =>
      spellId
        .split('|')
        .map((k) => entities.get(k))
        .filter((e): e is EntityDetail => e !== undefined)
        .sort(
          (a, b) =>
            Number(a.data.level ?? 0) - Number(b.data.level ?? 0) ||
            a.name.localeCompare(b.name, 'en'),
        ),
    [spellId, entities],
  );
  const hiddenId = hidden.join('|');
  const dc = view?.sheet.spellcasting[0]?.dc.value;

  const cards = useMemo<PackItem[]>(() => {
    if (!character || !view) return [];
    const shown = (s: PrintSection) => !hiddenId.split('|').includes(s);
    const groups: { title: string; cards: PackItem[] }[] = [];
    if (shown('spellCards')) {
      for (let lvl = 0; lvl <= 9; lvl++) {
        const list = spells.filter((s) => (s.data.level ?? 0) === lvl);
        groups.push({
          title: lvl === 0 ? 'Cantrips' : `${ORDINAL(lvl)}-level spells`,
          cards: list.map((s) => ({
            id: s.key,
            node: <PrintCard entity={s} extra={<SaveLine spell={s} dc={dc} />} />,
          })),
        });
      }
    }
    if (shown('featureCards')) {
      groups.push({
        title: 'Features and traits',
        cards: printedFeatures(character, view, entities).flatMap(({ feature: f, text }) => {
          return text.length === 0
            ? []
            : [
                {
                  id: `feature:${f.key}`,
                  node: (
                    <FeatureCard
                      from={f.from}
                      title={f.name}
                      subtitle={`${sourceLabel(f.from, view)}${f.level ? ` — Level ${String(f.level)}` : ''}`}
                    >
                      <Entries entries={text} />
                    </FeatureCard>
                  ),
                },
              ];
        }),
      });
    }
    if (shown('itemCards')) {
      groups.push({
        title: 'Items',
        cards: (character.decisions.inventory ?? []).flatMap((it, i) => {
          const e = entities.get(it.key);
          return e ? [{ id: `item:${String(i)}:${it.key}`, node: <PrintCard entity={e} /> }] : [];
        }),
      });
    }
    // Each group's heading travels with its first card; groups follow on without a page break,
    // so the pages stay full.
    return groups
      .filter((g) => g.cards.length > 0)
      .flatMap((g) => [
        {
          id: `heading:${g.title}`,
          keepWithNext: true,
          node: (
            <h2 className="border-b border-border pb-0.5 font-serif text-xs font-bold tracking-widest text-header uppercase">
              {g.title}
            </h2>
          ),
        },
        ...g.cards,
      ]);
  }, [character, view, spells, entities, hiddenId, dc]);

  const key = `${cards.map((c) => c.id).join('|')}#${String(entities.size)}`;
  const { packing, measurer } = usePacking(cards, key);
  const features = useMemo(
    () =>
      character && view ? printedFeatures(character, view, entities).map((p) => p.feature) : [],
    [character, view, entities],
  );
  return { entities, spells, features, cards, packing, measurer };
}

/**
 * The features the sheet prints, each with its text: without the features it only embeds (they
 * print on their own), without the ones that only ask for a choice, and species traits as the
 * chosen lineage tells them.
 */
export function printedFeatures(
  character: CharacterFile,
  view: CharacterView,
  entities: Map<string, EntityDetail>,
): { feature: CharacterView['features'][number]; text: unknown[] }[] {
  return view.features.flatMap((f) => {
    const hash = f.key.indexOf('#');
    const species = hash < 0 ? undefined : entities.get(f.key.slice(0, hash));
    const raw =
      (species && lineageTrait(species, f.name, character.decisions)) ??
      featureText(f.key, f.name, entities);
    const text = withoutReferences(raw);
    return asksOnly(f, view.choices, text) ? [] : [{ feature: f, text }];
  });
}

/** A feature's text: its entity's, or a species trait's from the species entries. */
function featureText(key: string, name: string, entities: Map<string, EntityDetail>): unknown {
  const hash = key.indexOf('#');
  if (hash < 0) return entities.get(key)?.data.entries;
  const species = entities.get(key.slice(0, hash));
  const entries = Array.isArray(species?.data.entries) ? (species.data.entries as unknown[]) : [];
  const entry = entries.find(
    (e) => typeof e === 'object' && e !== null && 'name' in e && e.name === name,
  );
  return typeof entry === 'object' && entry !== null && 'entries' in entry
    ? entry.entries
    : undefined;
}
