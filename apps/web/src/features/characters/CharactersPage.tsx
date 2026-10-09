import { Button } from '@boh/ui';
import { Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import type { CharacterFile } from '../../app/characters/model';
import { useCharacters } from '../../app/characters/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { PortraitImage } from './Portrait';

/** Stands for the library in selects (campaign ids are slugs, never start with @). */
const LIBRARY = '@library';

/**
 * Characters: the open campaign's first, then other campaigns', then the library (characters
 * kept outside any campaign). Any character can be copied into another campaign or the library.
 */
export function CharactersPage() {
  usePageTitle('Characters');
  const { characters, loaded, load, create, copyTo, remove } = useCharacters();
  const { campaigns, loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [where, setWhere] = useState<string>(active?.id ?? LIBRARY);
  // A character follows its campaign's rules (2024 for mixed campaigns and the library).
  const edition: '2014' | '2024' =
    campaigns.find((c) => c.id === where)?.edition === '2014' ? '2014' : '2024';

  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);

  const start = async () => {
    const c = await create(name, edition, where === LIBRARY ? undefined : where);
    setCreating(false);
    setName('');
    navigate(`/characters/${c.id}?step=class`);
  };

  const groups: { id: string; title: string; list: CharacterFile[] }[] = [
    ...[...campaigns]
      .sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))
      .map((c) => ({
        id: c.id,
        title: c.name,
        list: characters.filter((x) => x.campaign === c.id),
      })),
    { id: LIBRARY, title: 'Library', list: characters.filter((x) => !x.campaign) },
  ].filter((g) => g.list.length > 0);
  const places = [
    ...campaigns.map((c) => ({ id: c.id, label: c.name })),
    { id: LIBRARY, label: 'Library' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-2xl font-bold">Characters</h1>
        <Button
          variant="primary"
          onClick={() => {
            setWhere(active?.id ?? LIBRARY);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New character
        </Button>
      </div>

      {creating && (
        <form
          aria-label="New character"
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-character-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id="new-character-name"
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-character-where" className="mb-1 block text-sm font-medium">
                Keep in
              </label>
              <select
                id="new-character-where"
                value={where}
                onChange={(e) => {
                  setWhere(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted">
            {edition} rules, as{' '}
            {where === LIBRARY ? 'characters outside campaigns' : 'the campaign'}.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Start building
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

      {loaded && characters.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          <Users className="mx-auto mb-2 h-8 w-8" aria-hidden />
          No characters yet. The builder walks you through class, species, background, abilities,
          equipment and spells, and keeps track of every choice still open.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-label={g.title}>
          <h2 className="mb-2 font-serif text-lg font-bold">{g.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.list.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <PortraitImage character={c} size={48} />
                <AppLink
                  to={`/characters/${c.id}?step=class`}
                  className="min-w-0 flex-1 hover:text-accent-ink"
                >
                  <span className="block truncate font-serif text-lg font-bold">{c.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.summary || 'Not built yet'}
                  </span>
                </AppLink>
                <select
                  aria-label={`Copy ${c.name} to`}
                  value=""
                  onChange={(e) => {
                    const target = e.target.value;
                    void copyTo(c.id, target === LIBRARY ? undefined : target);
                  }}
                  className="w-24 rounded-md border border-border bg-surface px-1 py-1 text-sm"
                >
                  <option value="" disabled>
                    Copy to…
                  </option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete ${c.name}? This cannot be undone.`))
                      void remove(c.id);
                  }}
                  className="rounded p-1.5 text-muted hover:bg-sunken hover:text-text"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
