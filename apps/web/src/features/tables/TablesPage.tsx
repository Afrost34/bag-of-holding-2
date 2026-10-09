import { Button, ConfirmDelete } from '@boh/ui';
import { Plus, Dices } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import { TABLE_KINDS, type RollTable, type TableKind } from '../../app/tables/model';
import { useTables } from '../../app/tables/store';
import { TreasureRoller } from '../../app/tables/TreasureRoller';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** Stands for "no campaign" in selects (campaign ids are slugs, never start with @). */
const LIBRARY = '@library';

/** Roll tables: loot, shops and random encounters, the open campaign's first. */
export function TablesPage() {
  usePageTitle('Tables');
  const { tables: sheets, loaded, load, create, remove } = useTables();
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [where, setWhere] = useState(active?.id ?? LIBRARY);
  const [kind, setKind] = useState<TableKind>('loot');

  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);

  const groups: { id: string; title: string; list: RollTable[] }[] = [
    ...[...campaigns]
      .sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))
      .map((c) => ({ id: c.id, title: c.name, list: sheets.filter((s) => s.campaign === c.id) })),
    { id: LIBRARY, title: 'Not in a campaign', list: sheets.filter((s) => !s.campaign) },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-2xl font-bold">Tables</h1>
        <Button
          variant="primary"
          onClick={() => {
            setWhere(active?.id ?? LIBRARY);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New table
        </Button>
      </div>

      <section
        aria-label="Treasure"
        className="space-y-2 rounded-lg border border-border bg-surface p-4"
      >
        <h2 className="font-serif text-lg font-bold">Treasure by challenge rating</h2>
        <TreasureRoller edition={active?.edition === '2014' ? '2014' : '2024'} />
      </section>

      {creating && (
        <form
          aria-label="New table"
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(name, kind, where === LIBRARY ? undefined : where).then((s) => {
              setCreating(false);
              setName('');
              navigate(`/tables/${s.id}`);
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="new-table-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id="new-table-name"
                value={name}
                autoFocus
                placeholder="Forest road, Smithy, Dragon hoard…"
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-table-kind" className="mb-1 block text-sm font-medium">
                Kind
              </label>
              <select
                id="new-table-kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as TableKind);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
              >
                {TABLE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-table-where" className="mb-1 block text-sm font-medium">
                Keep in
              </label>
              <select
                id="new-table-where"
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
          <Dices className="mx-auto mb-2 h-8 w-8" aria-hidden />
          No tables yet.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-label={g.title}>
          <h2 className="mb-2 font-serif text-lg font-bold">{g.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.list.map((s) => (
              <li key={s.id} className="relative">
                <AppLink
                  to={`/tables/${s.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 hover:border-accent"
                >
                  <span className="block truncate font-serif text-lg font-bold">{s.name}</span>
                  <span className="block text-sm text-muted">
                    {TABLE_KINDS.find((k) => k.id === s.kind)?.label} · {s.rows.length} rows
                  </span>
                </AppLink>
                <ConfirmDelete
                  name={s.name}
                  onDelete={() => void remove(s.id)}
                  className="absolute top-2 right-2"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
