import { makeKey } from '@boh/data5e';
import { Entries, EntityView, RichText } from '@boh/renderer';
import { useEffect } from 'react';
import { AppLink } from '../../app/AppLink';
import { useEntity } from '../../app/data/entities';
import { useSourceList } from '../../app/data/sourceList';
import { BusyNotice } from '../../app/data/BusyNotice';
import { useData } from '../../app/data/store';
import { EntityMeta } from '../../app/renderer/EntityCard';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** Fluff (lore and art) lives in a parallel `<type>Fluff` entity with the same name and source. */
function useFluff(type: string, name: string, source: string) {
  const key = type.endsWith('Fluff') || !name ? null : makeKey(`${type}Fluff`, [name], source);
  return useEntity(key);
}

export function EntityPage({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  const status = useData((s) => s.status);
  const refresh = useData((s) => s.refresh);
  const loadSources = useSourceList((s) => s.load);
  const entity = state.status === 'found' ? state.entity : null;
  const fluff = useFluff(entity?.type ?? '', entity?.name ?? '', entity?.source ?? '');

  usePageTitle(entity?.name);
  useEffect(() => {
    void refresh();
    void loadSources();
  }, [refresh, loadSources]);

  if (status?.storage === 'busy') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <BusyNotice />
      </div>
    );
  }
  if (state.status === 'loading') {
    return <p className="p-8 text-muted">Loading…</p>;
  }
  if (!entity) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Not found</h1>
        <p className="mt-2 text-muted">
          {status?.installed === false
            ? 'The 5etools data is not downloaded on this device yet.'
            : 'This entry is not in your data. Its source may have been removed in an update.'}
        </p>
        <AppLink
          to="/settings/data"
          className="mt-4 inline-block font-medium text-link hover:underline"
        >
          Data & sources
        </AppLink>
      </div>
    );
  }

  const fluffData = fluff.status === 'found' ? fluff.entity.data : null;
  const images = Array.isArray(fluffData?.images) ? fluffData.images : [];
  const lore = fluffData?.entries;

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-4 border-b-2 border-accent/60 pb-2">
        <h1 className="font-serif text-3xl font-bold">
          <RichText text={entity.name} />
        </h1>
        <EntityMeta entity={entity} className="mt-1" />
      </header>

      {images.length > 0 && entity.type === 'monster' && (
        <div className="float-right mb-3 ml-4 w-40 sm:w-56">
          <Entries entries={images.slice(0, 1)} />
        </div>
      )}

      <div className="text-[15px] leading-relaxed">
        <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
      </div>

      {lore !== undefined && (
        <section className="clear-both mt-8">
          <h2 className="mb-2 border-b border-border font-serif text-xl font-bold">Lore</h2>
          <div className="text-[15px] leading-relaxed">
            <Entries entries={lore} depth={1} />
            {images.length > 1 && (
              <Entries entries={[{ type: 'gallery', images: images.slice(1) }]} />
            )}
          </div>
        </section>
      )}
    </article>
  );
}
