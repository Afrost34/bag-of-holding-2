import type { EntityDetail } from '@boh/data5e';
import { creatureType, sizeText, speed } from '@boh/data5e/format';
import { Entries, RichText } from '@boh/renderer';
import { useSpeciesPage } from '../../../app/data/pages';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { LegacyBadge } from '../LegacyBadge';
import { ArticleLayout, EntityHero, type TocItem } from './ArticleLayout';
import { PageMissing } from './PageMissing';
import { abilityText } from './speciesFacts';

const subraceId = (i: number) => `lineage-${String(i)}`;

/** Ability scores, type, size and speed: stored as fields, not in the trait text. */
function Facts({ data }: { data: EntityDetail['data'] }) {
  const facts: [string, string][] = [
    ['Ability Scores', abilityText(data.ability)],
    ['Creature Type', data.creatureTypes !== undefined ? creatureType(data.creatureTypes) : ''],
    ['Size', data.size !== undefined ? sizeText(data.size) : ''],
    ['Speed', data.speed !== undefined ? speed(data.speed) : ''],
  ];
  const shown = facts.filter(([, v]) => v !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}</dt>
          <dd>
            <RichText text={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A species with its traits and its subraces or lineages. */
export function SpeciesPage({ entityKey }: { entityKey: string }) {
  const state = useSpeciesPage(entityKey);
  usePageTitle(state.status === 'found' ? state.page.race.name : undefined);
  if (state.status === 'loading') return <p className="p-8 text-muted">Loading…</p>;
  if (state.status === 'missing') return <PageMissing />;
  const { race, fluff, subraces } = state.page;

  const toc: TocItem[] = [
    { id: 'traits', label: `${race.name} Traits`, depth: 0 },
    ...(subraces.length ? [{ id: 'lineages', label: 'Subraces', depth: 0 }] : []),
    ...subraces.map((s, i) => ({ id: subraceId(i), label: `${s.name} (${s.source})`, depth: 1 })),
  ];

  return (
    <ArticleLayout toc={toc}>
      <EntityHero entity={race} fluff={fluff} />
      <section id="traits" className="scroll-mt-4">
        <h2 className="border-b border-border pb-1 font-serif text-2xl font-bold">
          {race.name} Traits
        </h2>
        <Facts data={race.data} />
        <Entries entries={race.data.entries} depth={2} />
      </section>
      {subraces.length > 0 && (
        <section id="lineages" className="mt-10 scroll-mt-4">
          <h2 className="border-b border-border pb-1 font-serif text-2xl font-bold">Subraces</h2>
          {subraces.map((s, i) => (
            <section key={s.key} id={subraceId(i)} className="mt-6 scroll-mt-4">
              <h3 className="flex flex-wrap items-center gap-2 font-serif text-xl font-bold">
                <RichText text={`${race.name} (${s.name})`} />
                {Array.isArray(s.data.reprintedAs) && <LegacyBadge />}
                <span className="font-sans text-xs font-normal text-muted">{s.source}</span>
              </h3>
              <Facts data={s.data} />
              <Entries entries={s.data.entries} depth={2} />
            </section>
          ))}
        </section>
      )}
    </ArticleLayout>
  );
}
