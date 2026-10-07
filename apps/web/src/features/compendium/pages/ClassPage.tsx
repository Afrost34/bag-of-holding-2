import type { ClassPage as ClassPageData, FeatureEntry, SubclassSummary } from '@boh/data5e';
import { ClassTable, ClassTraits, type TableFeature } from '@boh/renderer';
import { cn } from '@boh/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppLink } from '../../../app/AppLink';
import { entityPath } from '../../../app/data/entities';
import { useClassPage, useSubclassPage } from '../../../app/data/pages';
import { useSourceList } from '../../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../../app/data/sourcePrefs';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { LegacyBadge } from '../LegacyBadge';
import {
  ArticleLayout,
  EntityHero,
  FeatureSection,
  LoreSection,
  type TocItem,
} from './ArticleLayout';
import { PageMissing } from './PageMissing';
import { scrollToSection } from './scroll';

const featureId = (i: number) => `feature-${String(i)}`;
const subFeatureId = (i: number) => `subclass-feature-${String(i)}`;

/** A class: core traits, the class table, every feature by level, and its subclasses. */
export function ClassPage({ entityKey, subclass }: { entityKey: string; subclass?: string }) {
  const state = useClassPage(entityKey);
  usePageTitle(state.status === 'found' ? state.page.cls.name : undefined);
  if (state.status === 'loading') return <p className="p-8 text-muted">Loading…</p>;
  if (state.status === 'missing') return <PageMissing />;
  return <ClassArticle page={state.page} selected={subclass} />;
}

function ClassArticle({ page, selected }: { page: ClassPageData; selected: string | undefined }) {
  const { cls, fluff, features, subclasses } = page;
  const name = cls.name;
  const edition = cls.edition;
  const selectedSummary = subclasses.find((s) => s.key === selected);
  const subclassTitle =
    typeof cls.data.subclassTitle === 'string' ? cls.data.subclassTitle : 'Subclass';

  const toc: TocItem[] = [
    { id: 'traits', label: `Core ${name} Traits`, depth: 0 },
    { id: 'features', label: `${name} Features`, depth: 0 },
    ...features.map((f, i) => ({
      id: featureId(i),
      label: `${String(f.level)}: ${f.name}`,
      depth: 1,
    })),
    { id: 'subclasses', label: `${name} Subclasses`, depth: 0 },
  ];
  const tableFeatures: TableFeature[] = features.map((f, i) => ({
    level: f.level,
    name: f.name,
    anchor: featureId(i),
  }));

  return (
    <ArticleLayout toc={toc}>
      <EntityHero entity={cls} fluff={fluff} tagline />

      <section id="traits" className="scroll-mt-4">
        <ClassTraits name={name} data={cls.data} edition={edition} />
      </section>

      <section id="features" className="mt-8 scroll-mt-4">
        <h2 className="border-b border-border pb-1 font-serif text-2xl font-bold">
          {name} Class Features
        </h2>
        <p className="mt-2 text-muted">
          As a {name}, you gain the following class features when you reach the specified {name}{' '}
          levels.
        </p>
        <ClassTable
          name={name}
          data={cls.data}
          features={tableFeatures}
          renderFeature={(f) => (
            <button
              type="button"
              onClick={() => {
                if (f.anchor) scrollToSection(f.anchor);
              }}
              className="text-link hover:underline"
            >
              {f.name}
            </button>
          )}
        />
        {features.map((f, i) => (
          <FeatureSection
            key={f.key}
            id={featureId(i)}
            level={f.level}
            name={f.name}
            entity={f.entity}
          >
            {f.gainSubclass && (
              <p className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    scrollToSection('subclasses');
                  }}
                  className="font-medium text-link hover:underline"
                >
                  Choose a {subclassTitle.toLowerCase()} below
                </button>
              </p>
            )}
          </FeatureSection>
        ))}
      </section>

      <section id="subclasses" className="mt-10 scroll-mt-4">
        <h2 className="border-b border-border pb-1 font-serif text-2xl font-bold">
          {name} Subclasses
        </h2>
        <SubclassPicker subclasses={subclasses} selected={selected} />
        {selectedSummary && <SubclassFeatures summary={selectedSummary} />}
      </section>

      <LoreSection fluff={fluff} />
    </ArticleLayout>
  );
}

/** Subclasses as cards, 2024 first; picking one shows its features below. */
function SubclassPicker({
  subclasses,
  selected,
}: {
  subclasses: readonly SubclassSummary[];
  selected: string | undefined;
}) {
  const navigate = useNavigate();
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  useEffect(() => {
    void load();
  }, [load]);
  const sourceName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  // Sources turned off in Settings are hidden everywhere, subclasses included.
  const disabled = new Set(disabledSourceIds(sources, overrides).map((s) => s.toLowerCase()));
  const shown = subclasses.filter(
    (s) => !disabled.has(s.source.toLowerCase()) || s.key === selected,
  );
  if (shown.length === 0) return <p className="mt-2 text-muted">No subclasses.</p>;
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Subclasses">
      {shown.map((s) => {
        const on = s.key === selected;
        return (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => {
                void navigate({ to: '.', search: on ? {} : { sc: s.key }, replace: true });
              }}
              className={cn(
                'flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                on
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                {s.name}
                {s.legacy && <LegacyBadge />}
              </span>
              <span className="text-xs text-muted">{sourceName(s.source)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SubclassFeatures({ summary }: { summary: SubclassSummary }) {
  const state = useSubclassPage(summary.key);
  if (state.status !== 'found') {
    return (
      <p className="mt-4 text-muted">{state.status === 'loading' ? 'Loading…' : 'Not found.'}</p>
    );
  }
  const { features } = state.page;
  return (
    <div className="mt-6 rounded-lg border border-accent/50 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-xl font-bold">{summary.name}</h3>
        <AppLink
          to={entityPath(summary.key)}
          className="text-sm font-medium text-link hover:underline"
        >
          Open subclass page
        </AppLink>
      </div>
      <FeatureList features={features} idOf={subFeatureId} />
    </div>
  );
}

export function FeatureList({
  features,
  idOf,
}: {
  features: readonly FeatureEntry[];
  idOf: (i: number) => string;
}) {
  return (
    <>
      {features.map((f, i) => (
        <FeatureSection key={f.key} id={idOf(i)} level={f.level} name={f.name} entity={f.entity} />
      ))}
    </>
  );
}
