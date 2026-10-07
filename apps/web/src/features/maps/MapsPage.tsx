import { Button } from '@boh/ui';
import { Map as MapIcon, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import type { MapDoc } from '../../app/maps/model';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** Stands for "no campaign" in selects (campaign ids are slugs, never start with @). */
const LIBRARY = '@library';

/** Maps: battle, city and world maps, the open campaign's first. */
export function MapsPage() {
  usePageTitle('Maps');
  const { maps: sheets, loaded, load, create } = useMaps();
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [where, setWhere] = useState(active?.id ?? LIBRARY);

  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);

  const groups: { id: string; title: string; list: MapDoc[] }[] = [
    ...[...campaigns]
      .sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))
      .map((c) => ({ id: c.id, title: c.name, list: sheets.filter((s) => s.campaign === c.id) })),
    { id: LIBRARY, title: 'Not in a campaign', list: sheets.filter((s) => !s.campaign) },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
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
      <p className="text-muted">
        Battle, city and world maps: a picture or a blank canvas, a square or hex grid, layers of
        stamps, brushes, walls, text and spell templates, and pins to notes and maps inside maps.
      </p>

      {creating && (
        <form
          aria-label="New map"
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(name, where === LIBRARY ? undefined : where).then((s) => {
              setCreating(false);
              setName('');
              navigate(`/maps/${s.id}`);
            });
          }}
        >
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
                <option value={LIBRARY}>Not in a campaign</option>
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

      {groups.map((g) => (
        <section key={g.id} aria-label={g.title}>
          <h2 className="mb-2 font-serif text-lg font-bold">{g.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.list.map((s) => (
              <li key={s.id}>
                <AppLink
                  to={`/maps/${s.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 hover:border-accent"
                >
                  <span className="block truncate font-serif text-lg font-bold">{s.name}</span>
                  <span className="block text-sm text-muted">
                    {s.width} × {s.height} px · {s.layers.reduce((n, l) => n + l.items.length, 0)}{' '}
                    items
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
