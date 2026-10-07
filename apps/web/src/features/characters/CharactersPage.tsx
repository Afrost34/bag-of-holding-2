import { Button } from '@boh/ui';
import { Copy, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign } from '../../app/campaigns/store';
import { useCharacters } from '../../app/characters/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** The character library: every character, and a button to start a new one. */
export function CharactersPage() {
  usePageTitle('Characters');
  const { characters, loaded, load, create, duplicate, remove } = useCharacters();
  const campaign = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [edition, setEdition] = useState<'2014' | '2024'>(
    campaign?.edition === '2014' ? '2014' : '2024',
  );

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const start = async () => {
    const c = await create(name, edition);
    setCreating(false);
    setName('');
    navigate(`/characters/${c.id}?step=class`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-2xl font-bold">Characters</h1>
        <Button
          variant="primary"
          onClick={() => {
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
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Rules</legend>
            <div className="flex gap-4 text-sm">
              {(['2024', '2014'] as const).map((e) => (
                <label key={e} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="new-character-edition"
                    checked={edition === e}
                    onChange={() => {
                      setEdition(e);
                    }}
                  />
                  {e} rules
                </label>
              ))}
            </div>
          </fieldset>
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

      <ul className="grid gap-3 sm:grid-cols-2">
        {characters.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-4"
          >
            <AppLink
              to={`/characters/${c.id}?step=class`}
              className="min-w-0 flex-1 hover:text-accent"
            >
              <span className="block truncate font-serif text-lg font-bold">{c.name}</span>
              <span className="block truncate text-sm text-muted">
                {c.summary || 'Not built yet'}
              </span>
            </AppLink>
            <button
              type="button"
              aria-label={`Copy ${c.name}`}
              onClick={() => {
                void duplicate(c.id);
              }}
              className="rounded p-1.5 text-muted hover:bg-sunken hover:text-text"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Delete ${c.name}`}
              onClick={() => {
                if (window.confirm(`Delete ${c.name}? This cannot be undone.`)) void remove(c.id);
              }}
              className="rounded p-1.5 text-muted hover:bg-sunken hover:text-text"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
