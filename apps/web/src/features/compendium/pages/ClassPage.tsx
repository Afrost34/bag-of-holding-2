import type { ClassPage as ClassPageData, FeatureEntry } from '@boh/data5e';
import { ClassTable, ClassTraits, type TableFeature } from '@boh/renderer';
import { cn } from '@boh/ui';
import { useNavigate } from '@tanstack/react-router';
import { AppLink } from '../../../app/AppLink';
import { entityPath } from '../../../app/data/entities';
import { useClassPage, useSubclassPage } from '../../../app/data/pages';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { ArticleLayout, EntityHero, FeatureSection, type TocItem } from './ArticleLayout';
import { mergeFeatures } from './classMerge';
import { PageMissing } from './PageMissing';
import { scrollToSection } from './scroll';
import { SubclassSelect } from './SubclassSelect';

const featureId = (i: number) => `feature-${String(i)}`;

/**
 * A class: core traits, the class table and every feature by level. Choosing a subclass at the
 * top merges its features in at their levels, in the list and in the table.
 */
export function ClassPage({ entityKey, subclass }: { entityKey: string; subclass?: string }) {
  const state = useClassPage(entityKey);
  usePageTitle(state.status === 'found' ? state.page.cls.name : undefined);
  if (state.status === 'loading') return <p className="p-8 text-muted">Loading…</p>;
  if (state.status === 'missing') return <PageMissing />;
  return <ClassArticle page={state.page} selected={subclass} />;
}

function ClassArticle({ page, selected }: { page: ClassPageData; selected: string | undefined }) {
  const navigate = useNavigate();
  const { cls, fluff, features, subclasses } = page;
  const name = cls.name;
  const subclassTitle =
    typeof cls.data.subclassTitle === 'string' ? cls.data.subclassTitle : 'Subclass';
  const summary = subclasses.find((s) => s.key === selected);
  const sub = useSubclassPage(summary?.key ?? '');
  const subPage = summary && sub.status === 'found' ? sub.page : undefined;
  const merged = mergeFeatures(features, subPage?.features ?? [], subclassTitle);

  const select = (key: string | undefined) => {
    void navigate({ to: '.', search: key ? { sc: key } : {}, replace: true });
  };
  const picker = (
    <SubclassSelect
      title={subclassTitle}
      subclasses={subclasses}
      selected={selected}
      onSelect={select}
    />
  );

  const toc: TocItem[] = [
    { id: 'traits', label: `Core ${name} Traits`, depth: 0 },
    { id: 'features', label: `${name} Features`, depth: 0 },
    ...merged.map((m, i) => ({
      id: featureId(i),
      label: `${String(m.feature.level)}: ${m.feature.name}`,
      depth: 1,
    })),
  ];
  const tableFeatures: TableFeature[] = merged.map((m, i) => ({
    level: m.feature.level,
    name: m.feature.name,
    anchor: featureId(i),
  }));
  const fromSubclass = new Set(
    merged.flatMap((m, i) => (m.from === 'subclass' ? [featureId(i)] : [])),
  );

  return (
    <ArticleLayout toc={toc}>
      <EntityHero entity={cls} fluff={fluff} tagline>
        {subclasses.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {picker}
            {summary && (
              <AppLink
                to={entityPath(summary.key)}
                className="text-sm font-medium text-link hover:underline"
              >
                Open {summary.name}
              </AppLink>
            )}
          </div>
        )}
      </EntityHero>

      <section id="traits" className="scroll-mt-4">
        <ClassTraits name={name} data={cls.data} edition={cls.edition} />
      </section>

      <section id="features" className="mt-8 scroll-mt-4">
        <h2 className="border-b border-border pb-1 font-serif text-2xl font-bold">
          {name} Class Features
          {summary && <span className="font-normal text-muted"> · {summary.name}</span>}
        </h2>
        <p className="mt-2 text-muted">
          As a {name}, you gain the following class features when you reach the specified {name}{' '}
          levels.
          {summary && ` Features from ${summary.name} are marked.`}
        </p>
        <ClassTable
          name={name}
          data={cls.data}
          features={tableFeatures}
          extraGroups={subPage?.subclass.data.subclassTableGroups}
          renderFeature={(f) => (
            <button
              type="button"
              onClick={() => {
                if (f.anchor) scrollToSection(f.anchor);
              }}
              className={cn(
                'hover:underline',
                f.anchor && fromSubclass.has(f.anchor)
                  ? 'font-semibold text-accent-ink'
                  : 'text-link',
              )}
            >
              {f.name}
            </button>
          )}
        />
        {merged.map(({ feature, from }, i) => (
          <FeatureSection
            key={`${from}:${feature.key}`}
            id={featureId(i)}
            level={feature.level}
            name={feature.name}
            entity={feature.entity}
            {...(from === 'subclass' && summary ? { badge: summary.name } : {})}
          >
            {feature.gainSubclass && subclasses.length > 0 && <div className="mt-3">{picker}</div>}
          </FeatureSection>
        ))}
      </section>
    </ArticleLayout>
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
