import { Button, ConfirmDelete } from '@boh/ui';
import { Map as MapIcon, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import { thumbnailUrl } from '../../app/maps/assets';
import {
  filterMaps,
  mapFolders,
  mapTags,
  type MapDoc,
  type MapFilter,
  type MapKind,
} from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** Stands for "no campaign" in selects (campaign ids are slugs, never start with @). */
const LIBRARY = '@library';

/** Maps: battle, city and world maps, the open campaign's first. */
export function MapsPage() {
  usePageTitle('Maps');
  const { maps: sheets, loaded, load, create, remove } = useMaps();
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [where, setWhere] = useState(active?.id ?? LIBRARY);
  const [kind, setKind] = useState<MapKind>('battle');

  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);

  const [filter, setFilter] = useState<MapFilter>({ q: '', folder: '', tags: [] });
  const folders = useMemo(() => mapFolders(sheets), [sheets]);
  const tags = useMemo(() => mapTags(sheets), [sheets]);
  const found = useMemo(
    () =>
      filterMaps(sheets, filter).sort(
        (a, b) =>
          (a.folder ?? '').localeCompare(b.folder ?? '', 'en') ||
          a.name.localeCompare(b.name, 'en', { numeric: true }),
      ),
    [sheets, filter],
  );
  const groups: { id: string; title: string; list: MapDoc[] }[] = [
    ...[...campaigns]
      .sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))
      .map((c) => ({ id: c.id, title: c.name, list: found.filter((s) => s.campaign === c.id) })),
    { id: LIBRARY, title: 'Map library', list: found.filter((s) => !s.campaign) },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-2xl font-bold">Maps</h1>
        <Button
          variant="primary"
          onClick={() => {
            setWhere(active?.id ?? LIBRARY);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New map
        </Button>
      </div>

      {creating && (
        <form
          aria-label="New map"
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(name, where === LIBRARY ? undefined : where, kind).then((s) => {
              setCreating(false);
              setName('');
              navigate(`/maps/${s.id}/edit`);
            });
          }}
        >
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <legend className="mb-1 font-medium">Kind of map</legend>
            {(
              [
                ['battle', 'Battle map', 'grid, walls, spell templates'],
                ['world', 'World or city map', 'real size, travel times, routes'],
              ] as const
            ).map(([id, label, hint]) => (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="new-map-kind"
                  checked={kind === id}
                  onChange={() => {
                    setKind(id);
                  }}
                />
                {label} <span className="text-muted">({hint})</span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-map-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id="new-map-name"
                value={name}
                autoFocus
                placeholder="Cragmaw Hideout"
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-map-where" className="mb-1 block text-sm font-medium">
                Keep in
              </label>
              <select
                id="new-map-where"
                value={where}
                onChange={(e) => {
                  setWhere(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={LIBRARY}>Map library (no campaign)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loaded && sheets.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          <MapIcon className="mx-auto mb-2 h-8 w-8" aria-hidden />
          No maps yet.
        </div>
      )}

      {sheets.length > 0 && (
        <section aria-label="Find a map" className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-faint"
                aria-hidden
              />
              <input
                type="search"
                value={filter.q}
                aria-label="Search maps"
                placeholder="Search maps by name, folder or tag"
                onChange={(e) => {
                  setFilter({ ...filter, q: e.target.value });
                }}
                className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm"
              />
            </label>
            <select
              value={filter.kind ?? ''}
              aria-label="Kind of map"
              onChange={(e) => {
                const { kind: _k, ...rest } = filter;
                const v = e.target.value;
                setFilter(v === 'battle' || v === 'world' ? { ...rest, kind: v } : rest);
              }}
              className="h-10 rounded-md border border-border bg-surface px-2 text-sm"
            >
              <option value="">All maps</option>
              <option value="battle">Battle maps</option>
              <option value="world">World and city maps</option>
            </select>
            {folders.length > 0 && (
              <select
                value={filter.folder}
                aria-label="Folder"
                onChange={(e) => {
                  setFilter({ ...filter, folder: e.target.value });
                }}
                className="h-10 rounded-md border border-border bg-surface px-2 text-sm"
              >
                <option value="">All folders</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f.split('/').join(' › ')}
                  </option>
                ))}
              </select>
            )}
          </div>
          {tags.length > 0 && (
            <div role="group" aria-label="Tags" className="flex flex-wrap gap-1.5">
              {tags.slice(0, 30).map(([t, n]) => {
                const on = filter.tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setFilter({
                        ...filter,
                        tags: on ? filter.tags.filter((x) => x !== t) : [...filter.tags, t],
                      });
                    }}
                    className={
                      on
                        ? 'rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-fg'
                        : 'rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-sunken'
                    }
                  >
                    {t} <span className={on ? '' : 'text-muted'}>{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {loaded && sheets.length > 0 && groups.length === 0 && (
        <p className="text-muted">No map matches.</p>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-label={g.title}>
          <h2 className="mb-2 font-serif text-lg font-bold">
            {g.title} <span className="text-sm font-normal text-muted">{g.list.length}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.list.map((s) => (
              <li key={s.id} className="relative">
                <AppLink
                  to={`/maps/${s.id}`}
                  className="block overflow-hidden rounded-lg border border-border bg-surface hover:border-accent"
                >
                  <Thumbnail map={s} />
                  <span className="block px-2.5 pt-1.5 font-serif text-sm leading-snug font-bold">
                    {s.name}
                  </span>
                  <span className="block truncate px-2.5 pb-2 text-xs text-muted">
                    {[s.folder, ...(s.tags ?? [])].filter(Boolean).join(' · ') ||
                      `${String(s.width)} × ${String(s.height)} px`}
                  </span>
                </AppLink>
                <ConfirmDelete
                  name={s.name}
                  onDelete={() => void remove(s.id)}
                  className="absolute top-1 right-1"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A map's thumbnail, or its icon when it has none (a blank canvas, an older map). */
function Thumbnail({ map }: { map: MapDoc }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void thumbnailUrl(map.id, map.campaign).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [map.id, map.campaign]);
  return url ? (
    <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-sunken object-cover" />
  ) : (
    <span className="flex aspect-[4/3] w-full items-center justify-center bg-sunken text-faint">
      <MapIcon className="h-8 w-8" aria-hidden />
    </span>
  );
}
