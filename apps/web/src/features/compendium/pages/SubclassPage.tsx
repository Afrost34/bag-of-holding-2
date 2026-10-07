import { classFeatureRef } from '@boh/data5e';
import { ClassTable } from '@boh/renderer';
import { AppLink } from '../../../app/AppLink';
import { entityPath } from '../../../app/data/entities';
import { useSubclassPage } from '../../../app/data/pages';
import { usePageTitle } from '../../../app/tabs/usePageTitle';
import { ArticleLayout, EntityHero, type TocItem } from './ArticleLayout';
import { FeatureList } from './ClassPage';
import { PageMissing } from './PageMissing';
import { scrollToSection } from './scroll';

const featureId = (i: number) => `feature-${String(i)}`;

/** A subclass: its features by level, with the class table including them. */
export function SubclassPage({ entityKey }: { entityKey: string }) {
  const state = useSubclassPage(entityKey);
  usePageTitle(state.status === 'found' ? state.page.subclass.name : undefined);
  if (state.status === 'loading') return <p className="p-8 text-muted">Loading…</p>;
  if (state.status === 'missing') return <PageMissing />;
  const { subclass, fluff, cls, features } = state.page;

  // The class table with this subclass's features alongside the class's own.
  const classFeatures = Array.isArray(cls?.data.classFeatures)
    ? cls.data.classFeatures.flatMap((ref) => {
        const parsed = classFeatureRef(ref);
        return parsed && !parsed.gainSubclass ? [{ level: parsed.level, name: parsed.name }] : [];
      })
    : [];
  const tableFeatures = [
    ...classFeatures,
    ...features.map((f, i) => ({ level: f.level, name: f.name, anchor: featureId(i) })),
  ].sort((a, b) => a.level - b.level);

  const toc: TocItem[] = [
    { id: 'features', label: 'Features', depth: 0 },
    ...features.map((f, i) => ({
      id: featureId(i),
      label: `${String(f.level)}: ${f.name}`,
      depth: 1,
    })),
  ];

  return (
    <ArticleLayout toc={toc}>
      <EntityHero entity={subclass} fluff={fluff}>
        {cls && (
          <p className="mt-3 text-sm">
            A subclass of the{' '}
            <AppLink to={entityPath(cls.key)} className="font-medium text-link hover:underline">
              {cls.name}
            </AppLink>{' '}
            ({cls.edition}).
          </p>
        )}
      </EntityHero>
      {cls && (
        <ClassTable
          name={cls.name}
          data={cls.data}
          features={tableFeatures}
          extraGroups={subclass.data.subclassTableGroups}
          renderFeature={(f) =>
            f.anchor ? (
              <button
                type="button"
                onClick={() => {
                  if (f.anchor) scrollToSection(f.anchor);
                }}
                className="font-semibold text-link hover:underline"
              >
                {f.name}
              </button>
            ) : (
              <span className="text-muted">{f.name}</span>
            )
          }
        />
      )}
      <section id="features" className="mt-6 scroll-mt-4">
        <FeatureList features={features} idOf={featureId} />
      </section>
    </ArticleLayout>
  );
}
