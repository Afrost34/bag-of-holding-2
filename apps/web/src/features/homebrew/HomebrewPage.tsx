import { packCover, packEntries, packMeta, sourceIdFor } from '@boh/data5e';
import { Button, Panel } from '@boh/ui';
import { BookOpen, FlaskConical, Plus, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign } from '../../app/campaigns/store';
import { useHomebrew } from '../../app/data/homebrew';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { packPath, packSummary } from './packs';

/** Homebrew: your packs (each one a source, like a book), made in the app or imported. */
export function HomebrewPage() {
  usePageTitle('Homebrew');
  const { packs, loaded, load, importFile, createPack } = useHomebrew();
  const campaign = useActiveCampaign();
  const navigate = useAppNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [edition, setEdition] = useState<'2014' | '2024'>(
    campaign?.edition === '2014' ? '2014' : '2024',
  );
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const create = async () => {
    const clean = name.trim();
    if (!clean) return;
    const path = await createPack({
      id: sourceIdFor(clean),
      name: clean,
      edition,
      author: author.trim(),
    });
    setCreating(false);
    setName('');
    navigate(packPath(path));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-serif text-2xl font-bold">Homebrew</h1>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-sunken">
          <Upload className="h-4 w-4" aria-hidden /> Import a pack
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Pack file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) {
                void importFile(file).then((err) => {
                  setMessage(err ?? `Imported ${file.name}.`);
                });
              }
            }}
          />
        </label>
        <Button
          variant="primary"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New pack
        </Button>
      </div>
      <p className="text-muted">
        Your own items, monsters, spells, feats, backgrounds, species and classes. Each pack is a
        source like a book: its entries show up in the compendium, in search, in links and in the
        character builder, sync to your other devices, and can be shared as a 5etools homebrew file.
      </p>
      {message && (
        <p role="status" className="rounded-md bg-sunken px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {creating && (
        <Panel title="New pack">
          <form
            aria-label="New pack"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                placeholder="Rust & Sunfire"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
              />
              {name.trim() && (
                <span className="mt-1 block text-xs text-muted">
                  Shown as the source “{sourceIdFor(name)}” on its entries.
                </span>
              )}
            </label>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Rules</legend>
              <div className="flex gap-4 text-sm">
                {(['2024', '2014'] as const).map((e) => (
                  <label key={e} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="edition"
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
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Author (optional)</span>
              <input
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={!name.trim()}>
                Create pack
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
        </Panel>
      )}

      {!loaded ? (
        <p className="text-muted">Loading…</p>
      ) : packs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          <FlaskConical className="mx-auto mb-2 h-8 w-8" aria-hidden />
          No homebrew yet. Make a pack for your campaign, then add items to it.
        </div>
      ) : (
        <ul aria-label="Packs" className="grid gap-3 sm:grid-cols-2">
          {packs.map((p) => {
            const meta = packMeta(p.json);
            const cover = packCover(p.json);
            return (
              <li key={p.path}>
                <AppLink
                  to={packPath(p.path)}
                  className="flex gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent"
                >
                  <span className="flex aspect-[3/4] w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-sunken">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-faint" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg font-bold">
                      {meta?.name ?? p.fileName}
                    </span>
                    <span className="block text-xs text-muted">
                      {meta ? `${meta.id} · ${meta.edition} rules` : p.fileName}
                    </span>
                    <span className="mt-2 block text-sm">{packSummary(packEntries(p.json))}</span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
