import { Entries, EntityView, RichText } from '@boh/renderer';
import { useEffect } from 'react';
import { PageTools } from '../../app/annotations/PageTools';
import { AppLink } from '../../app/AppLink';
import { entityPath, SIDE_IMAGE_TYPES, useEntity, useFluff } from '../../app/data/entities';
import { useSpecificVariants } from '../../app/data/pages';
import { useSourceList } from '../../app/data/sourceList';
import { BusyNotice } from '../../app/data/BusyNotice';
import { useData } from '../../app/data/store';
import { EntityMeta } from '../../app/renderer/EntityCard';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { LinkedTables } from '../../app/tables/LinkedTables';
import { CopyToTables } from '../../app/tables/CopyToTables';

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
      <div className="mb-5">
        <PageTools noteId={entity.key} label={entity.name} />
      </div>
      <div className="-mt-3 mb-5 empty:hidden">
        <CopyToTables entity={entity} />
      </div>

      {images.length > 0 && SIDE_IMAGE_TYPES.has(entity.type) && (
        <div className="float-right mb-3 ml-4 w-40 sm:w-56">
          <Entries entries={images.slice(0, 1)} />
        </div>
      )}

      {isObj(entity.data.genericVariant) && typeof entity.data.baseItem === 'string' && (
        <p className="mb-3 text-sm text-muted">
          <RichText
            text={`A {@item ${String(entity.data.genericVariant.name)}|${String(entity.data.genericVariant.source)}} made from {@item ${entity.data.baseItem}}.`}
          />
        </p>
      )}

      <div className="text-[15px] leading-relaxed">
        <EntityView type={entity.type} data={entity.data} edition={entity.edition} />
      </div>

      {entity.type === 'magicvariant' && <AppliesTo entityKey={entity.key} />}

      <div className="clear-both mt-6 empty:hidden">
        <LinkedTables link={entity.key} />
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

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The specific items a generic variant makes ("+1 Weapon" → "+1 Longsword", …). */
function AppliesTo({ entityKey }: { entityKey: string }) {
  const state = useSpecificVariants(entityKey);
  if (state.status !== 'found' || state.page.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-2 border-b border-border font-serif text-xl font-bold">
        Applies to ({state.page.length})
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {state.page.map((item) => (
          <li key={item.key}>
            <AppLink
              to={entityPath(item.key)}
              className="inline-block rounded-md border border-border bg-surface px-2 py-1 text-sm hover:border-accent hover:text-accent-ink"
            >
              {item.name}
              <span className="ml-1.5 text-xs text-faint">{item.source}</span>
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
