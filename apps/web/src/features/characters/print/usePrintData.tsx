import { textToEntries, type EntityDetail } from '@boh/data5e';
import { Entries } from '@boh/renderer';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CharacterFile } from '../../../app/characters/model';
import { usePacking, type Packing, type PackItem } from '../../../app/cards/packing';
import { PrintCard } from '../../../app/cards/PrintCard';
import { loadEntity } from '../../../app/data/entities';
import type { CharacterView } from '../../../app/data/protocol';
import { FeatureCard, SaveLine } from './PrintCards';
import { inOrder, plainText } from './cardEdits';
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
  /** Every card the sheet can print, by group, to choose which ones print. */
  cardChoices: CardGroup[];
  /** What each printed card is (by its packing id): to arrange it on the page. */
  cardInfo: ReadonlyMap<string, CardPlace>;
  /** Cards left out: shown on a page of their own at the end of the preview, never printed. */
  hiddenCards: { choice: CardChoice; node: ReactNode }[];
}

/** A printed card, and the cards of its group (ids, in print order), to move it among them. */
export interface CardPlace {
  choice: CardChoice;
  group: string[];
}

export interface CardGroup {
  title: string;
  /** In the order they print. */
  cards: CardChoice[];
}

export interface CardChoice {
  /** What `printHidden`, `printOrder` and `printEdits` store for the card. */
  id: string;
  label: string;
  /** Its text as plain paragraphs, from the data: where editing starts. */
  source: string;
  /** The text rewritten by hand, if it was. */
  edited?: string;
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
  /** Sections left out, and single cards left out (by their `CardGroup` id). */
  hidden: readonly string[],
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
  // Joined by line breaks: card ids hold '|' (`feature:classfeature:x|bard|xphb|1@xphb`).
  const hiddenId = hidden.join('\n');
  const orderId = (character?.preferences.printOrder ?? []).join('\n');
  const editsId = JSON.stringify(character?.preferences.printEdits ?? {});
  const dc = view?.sheet.spellcasting[0]?.dc.value;

  const { cards, cardChoices, cardInfo, hiddenCards } = useMemo(() => {
    if (!character || !view)
      return {
        cards: [],
        cardChoices: [],
        cardInfo: new Map<string, CardPlace>(),
        hiddenCards: [],
      };
    const off = new Set(hiddenId.split('\n'));
    const order = orderId ? orderId.split('\n') : [];
    const edits = JSON.parse(editsId) as Record<string, string>;
    const shown = (s: PrintSection) => !off.has(s);
    const groups: {
      title: string;
      section: PrintSection;
      cards: (PackItem & { label: string; hideId: string; source: string })[];
    }[] = [];
    for (let lvl = 0; lvl <= 9; lvl++) {
      const list = spells.filter((s) => (s.data.level ?? 0) === lvl);
      groups.push({
        title: lvl === 0 ? 'Cantrips' : `${ORDINAL(lvl)}-level spells`,
        section: 'spellCards',
        cards: list.map((s) => ({
          id: s.key,
          hideId: s.key,
          label: s.name,
          source: plainText([s.data.entries, s.data.entriesHigherLevel]),
          node: <PrintCard entity={s} extra={<SaveLine spell={s} dc={dc} />} text={edits[s.key]} />,
        })),
      });
    }
    groups.push({
      title: 'Features and traits',
      section: 'featureCards',
      cards: printedFeatures(character, view, entities).flatMap(({ feature: f, text }) => {
        return text.length === 0
          ? []
          : [
              {
                id: `feature:${f.key}`,
                hideId: `feature:${f.key}`,
                label: f.name,
                source: plainText(text),
                node: (
                  <FeatureCard
                    from={f.from}
                    title={f.name}
                    subtitle={`${sourceLabel(f.from, view)}${f.level ? ` — Level ${String(f.level)}` : ''}`}
                  >
                    <Entries
                      entries={
                        edits[`feature:${f.key}`] === undefined
                          ? text
                          : textToEntries(edits[`feature:${f.key}`] ?? '')
                      }
                    />
                  </FeatureCard>
                ),
              },
            ];
      }),
    });
    groups.push({
      title: 'Items',
      section: 'itemCards',
      cards: (character.decisions.inventory ?? []).flatMap((it, i) => {
        const e = entities.get(it.key);
        return e
          ? [
              {
                id: `item:${String(i)}:${it.key}`,
                hideId: `item:${it.key}`,
                label: it.name ?? e.name,
                source: plainText(e.data.entries),
                node: <PrintCard entity={e} text={edits[`item:${it.key}`]} />,
              },
            ]
          : [];
      }),
    });
    // Each group in the player's order.
    for (const g of groups)
      g.cards = inOrder(
        g.cards.map((c) => ({ ...c, id: c.hideId, packId: c.id })),
        order,
      ).map(({ packId, ...c }) => ({ ...c, id: packId }));
    const choices: CardGroup[] = groups
      .filter((g) => g.cards.length > 0 && shown(g.section))
      .map((g) => ({
        title: g.title,
        cards: [
          ...new Map(
            g.cards.map((c): [string, CardChoice] => [
              c.hideId,
              {
                id: c.hideId,
                label: c.label,
                source: c.source,
                ...(edits[c.hideId] !== undefined ? { edited: edits[c.hideId] } : {}),
              },
            ]),
          ).values(),
        ],
      }));
    // Each group's heading travels with its first card. Spell levels follow on without a page
    // break, so those pages stay full; features and items start a page of their own.
    const packed = groups
      .filter((g) => shown(g.section))
      .map((g) => ({ ...g, cards: g.cards.filter((c) => !off.has(c.hideId)) }))
      .filter((g) => g.cards.length > 0)
      .flatMap((g, i, all): PackItem[] => [
        {
          id: `heading:${g.title}`,
          keepWithNext: true,
          // Spells, features and items each start on a page of their own; spell levels follow on.
          ...(i > 0 && all[i - 1]?.section !== g.section ? { breakBefore: true } : {}),
          node: (
            <h2 className="border-b border-border pb-1 text-center font-serif text-[13px] font-bold tracking-widest text-header uppercase">
              {g.title}
            </h2>
          ),
        },
        ...g.cards.map(({ id, node }) => ({ id, node })),
      ]);
    const info = new Map<string, CardPlace>();
    const hiddenCards: { choice: CardChoice; node: ReactNode }[] = [];
    for (const g of groups) {
      if (!shown(g.section)) continue;
      const choiceOf = new Map(
        (choices.find((c) => c.title === g.title)?.cards ?? []).map((c) => [c.id, c]),
      );
      const group = [...choiceOf.keys()];
      for (const c of g.cards) {
        const choice = choiceOf.get(c.hideId);
        if (!choice) continue;
        if (off.has(c.hideId)) hiddenCards.push({ choice, node: c.node });
        else info.set(c.id, { choice, group });
      }
    }
    return { cards: packed, cardChoices: choices, cardInfo: info, hiddenCards };
  }, [character, view, spells, entities, hiddenId, orderId, editsId, dc]);

  const key = `${cards.map((c) => c.id).join('|')}#${String(entities.size)}`;
  const { packing, measurer } = usePacking(cards, key);
  const features = useMemo(
    () =>
      character && view ? printedFeatures(character, view, entities).map((p) => p.feature) : [],
    [character, view, entities],
  );
  return {
    entities,
    spells,
    features,
    cards,
    packing,
    measurer,
    cardChoices,
    cardInfo,
    hiddenCards,
  };
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
