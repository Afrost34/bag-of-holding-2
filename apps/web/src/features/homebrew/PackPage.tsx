import {
  fluffImage,
  makeKey,
  packEntries,
  packMeta,
  putEntry,
  putFluffImage,
  removeEntry,
  type RawEntity,
} from '@boh/data5e';
import { Button } from '@boh/ui';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import { useHomebrew } from '../../app/data/homebrew';
import { typeLabel } from '../../app/format';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { CreatureEditor } from './CreatureEditor';
import { ItemEditor } from './ItemEditor';
import { packFile, packPath } from './packs';

/** Types the app has an editor for (more to come: creatures, spells). */
const EDITABLE = new Set(['item', 'monster']);

/**
 * One pack: its entries, and the editor when making or changing one (`new=item`,
 * `edit=item:Name`).
 */
export function PackPage({
  name,
  edit,
  isNew,
}: {
  name: string;
  edit: string | undefined;
  isNew: string | undefined;
}) {
  const { packs, loaded, load, savePack, remove } = useHomebrew();
  const navigate = useAppNavigate();
  const path = packFile(name);
  const pack = packs.find((p) => p.path === path);
  const meta = pack ? packMeta(pack.json) : null;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  usePageTitle(meta?.name ?? 'Homebrew');

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!pack || !meta) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Pack not found</h1>
        <AppLink to="/homebrew" className="mt-3 inline-block text-link hover:underline">
          Homebrew
        </AppLink>
      </div>
    );
  }

  const entries = packEntries(pack.json);
  const editing =
    edit !== undefined ? entries.find((e) => `${e.type}:${e.name}` === edit) : undefined;
  const linkTo = (type: string, entryName: string) =>
    entityPath(makeKey(type, [entryName], meta.id));

  const saveItem = async (item: RawEntity, image: string | null): Promise<string | null> => {
    try {
      const withItem = putEntry(pack.json, 'item', item, editing?.name);
      await savePack(
        path,
        putFluffImage(withItem, 'item', String(item.name).trim(), image, editing?.name),
      );
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    setMessage(`Saved “${String(item.name)}”.`);
    navigate(packPath(path));
    return null;
  };

  const saveCreature = async (
    creature: RawEntity,
    image: string | null,
  ): Promise<string | null> => {
    try {
      const withCreature = putEntry(pack.json, 'monster', creature, editing?.name);
      await savePack(
        path,
        putFluffImage(withCreature, 'monster', String(creature.name).trim(), image, editing?.name),
      );
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    setMessage(`Saved “${String(creature.name)}”.`);
    navigate(packPath(path));
    return null;
  };

  const exportPack = () => {
    const blob = new Blob([JSON.stringify(pack.json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pack.fileName;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  if (isNew === 'monster' || editing?.type === 'monster') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <p className="mb-1 text-sm">
          <AppLink to={packPath(path)} className="text-link hover:underline">
            {meta.name}
          </AppLink>
        </p>
        <h1 className="mb-4 font-serif text-2xl font-bold">
          {editing ? `Edit ${editing.name}` : 'New creature'}
        </h1>
        <CreatureEditor
          key={edit ?? 'new'}
          pack={meta}
          base={editing?.entity ?? null}
          image={editing ? fluffImage(pack.json, 'monster', editing.name) : null}
          onSave={saveCreature}
          onCancel={() => {
            navigate(packPath(path));
          }}
        />
      </div>
    );
  }

  if (isNew === 'item' || editing?.type === 'item') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <p className="mb-1 text-sm">
          <AppLink to={packPath(path)} className="text-link hover:underline">
            {meta.name}
          </AppLink>
        </p>
        <h1 className="mb-4 font-serif text-2xl font-bold">
          {editing ? `Edit ${editing.name}` : 'New item'}
        </h1>
        <ItemEditor
          key={edit ?? 'new'}
          pack={meta}
          base={editing?.entity ?? null}
          image={editing ? fluffImage(pack.json, 'item', editing.name) : null}
          onSave={saveItem}
          onCancel={() => {
            navigate(packPath(path));
          }}
        />
      </div>
    );
  }

  const groups = new Map<string, typeof entries>();
  for (const e of entries) groups.set(e.type, [...(groups.get(e.type) ?? []), e]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <p className="text-sm">
        <AppLink to="/homebrew" className="text-link hover:underline">
          Homebrew
        </AppLink>
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-bold">{meta.name}</h1>
          <p className="text-sm text-muted">
            Source {meta.id} · {meta.edition} rules{meta.author ? ` · by ${meta.author}` : ''}
          </p>
        </div>
        <Button onClick={exportPack}>
          <Download className="h-4 w-4" aria-hidden /> Export
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirm('pack');
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Delete pack
        </Button>
      </div>

      {confirm === 'pack' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-sm">
          <span className="flex-1">Delete “{meta.name}” and everything in it?</span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void remove(path).then(() => {
                navigate('/homebrew');
              });
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirm(null);
            }}
          >
            Keep
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-md bg-sunken px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            navigate(`${packPath(path)}?new=item`);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New item
        </Button>
        <Button
          onClick={() => {
            navigate(`${packPath(path)}?new=monster`);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New creature
        </Button>
        <Button disabled title="Coming next">
          <Plus className="h-4 w-4" aria-hidden /> New spell
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">Nothing in this pack yet.</p>
      ) : (
        [...groups].map(([type, list]) => (
          <section key={type} aria-label={typeLabel(type)}>
            <h2 className="mb-2 font-serif text-lg font-bold">
              {typeLabel(type)}{' '}
              <span className="text-sm font-normal text-faint">{list.length}</span>
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {list.map((e) => (
                <li key={e.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <AppLink
                    to={linkTo(e.type, e.name)}
                    className="flex-1 font-medium text-link hover:underline"
                  >
                    {e.name}
                  </AppLink>
                  {confirm === `${e.type}:${e.name}` ? (
                    <>
                      <span className="text-sm">Delete it?</span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setConfirm(null);
                          void savePack(
                            path,
                            putFluffImage(
                              removeEntry(pack.json, e.type, e.name),
                              e.type,
                              e.name,
                              null,
                            ),
                          );
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirm(null);
                        }}
                      >
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      {EDITABLE.has(e.type) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${e.name}`}
                          onClick={() => {
                            navigate(
                              `${packPath(path)}?edit=${encodeURIComponent(`${e.type}:${e.name}`)}`,
                            );
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${e.name}`}
                        onClick={() => {
                          setConfirm(`${e.type}:${e.name}`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
