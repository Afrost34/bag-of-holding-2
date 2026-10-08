import {
  classFeatures,
  fluffImage,
  makeKey,
  packCover,
  packEntries,
  packMeta,
  putClass,
  putEntry,
  putFluffImage,
  removeClass,
  removeEntry,
  setPackCover,
  type PackMeta,
  type RawEntity,
} from '@boh/data5e';
import { Entries, EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { BookOpen, ChevronRight, Download, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import { useHomebrew } from '../../app/data/homebrew';
import { typeLabel } from '../../app/format';
import { useAppNavigate } from '../../app/navigation';
import { shrinkImage } from '../../app/shrinkImage';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { CreatureEditor } from './CreatureEditor';
import { ItemEditor } from './ItemEditor';
import { BackgroundEditor, ClassEditor, FeatEditor, SpeciesEditor } from './OptionEditors';
import { SpellEditor } from './SpellEditor';
import { packFile, packPath, plural } from './packs';

/** What a pack can hold, in the order its sections and New buttons show. */
const KINDS = [
  { type: 'item', label: 'item' },
  { type: 'monster', label: 'monster' },
  { type: 'spell', label: 'spell' },
  { type: 'feat', label: 'feat' },
  { type: 'background', label: 'background' },
  { type: 'race', label: 'species' },
  { type: 'class', label: 'class' },
] as const;
type Kind = (typeof KINDS)[number]['type'];
const order = (t: string) => {
  const i = KINDS.findIndex((k) => k.type === t);
  return i < 0 ? KINDS.length : i;
};
const isKind = (t: string | undefined): t is Kind => KINDS.some((k) => k.type === t);

/** Entries shown with a picture (5etools keeps it in their fluff). */
const WITH_PICTURE = new Set(['item', 'monster']);

/**
 * One pack: a source of its own with a cover, its entries as compendium rows, and the editor
 * when making or changing one (`new=feat`, `edit=feat:Name`).
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
  const back = () => {
    navigate(packPath(path));
  };

  /** Writes the pack, then goes back to it with a note. */
  const write = async (json: RawEntity, saved: string): Promise<string | null> => {
    try {
      await savePack(path, json);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    setMessage(`Saved “${saved}”.`);
    back();
    return null;
  };
  const saveEntry =
    (type: Kind) =>
    (entity: RawEntity, image?: string | null): Promise<string | null> => {
      try {
        let json = putEntry(pack.json, type, entity, editing?.name);
        if (image !== undefined) {
          json = putFluffImage(json, type, String(entity.name).trim(), image, editing?.name);
        }
        return write(json, String(entity.name));
      } catch (error) {
        return Promise.resolve(error instanceof Error ? error.message : String(error));
      }
    };
  const saveClass = (cls: RawEntity, features: RawEntity[]): Promise<string | null> => {
    try {
      return write(putClass(pack.json, cls, features, editing?.name), String(cls.name));
    } catch (error) {
      return Promise.resolve(error instanceof Error ? error.message : String(error));
    }
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

  const kind = editing
    ? isKind(editing.type)
      ? editing.type
      : null
    : isKind(isNew)
      ? isNew
      : null;
  if (kind) {
    const base = editing?.entity ?? null;
    const props = { pack: meta, base, onCancel: back };
    const editor: Record<Kind, ReactNode> = {
      item: (
        <ItemEditor
          key={edit ?? 'new'}
          {...props}
          image={editing ? fluffImage(pack.json, 'item', editing.name) : null}
          onSave={saveEntry('item')}
        />
      ),
      monster: (
        <CreatureEditor
          key={edit ?? 'new'}
          {...props}
          image={editing ? fluffImage(pack.json, 'monster', editing.name) : null}
          onSave={saveEntry('monster')}
        />
      ),
      spell: <SpellEditor key={edit ?? 'new'} {...props} onSave={(e) => saveEntry('spell')(e)} />,
      feat: <FeatEditor key={edit ?? 'new'} {...props} onSave={(e) => saveEntry('feat')(e)} />,
      background: (
        <BackgroundEditor
          key={edit ?? 'new'}
          {...props}
          onSave={(e) => saveEntry('background')(e)}
        />
      ),
      race: <SpeciesEditor key={edit ?? 'new'} {...props} onSave={(e) => saveEntry('race')(e)} />,
      class: (
        <ClassEditor
          key={edit ?? 'new'}
          {...props}
          features={editing ? classFeatures(pack.json, editing.name) : []}
          onSave={saveClass}
        />
      ),
    };
    const label = KINDS.find((k) => k.type === kind)?.label ?? kind;
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <p className="mb-1 text-sm">
          <AppLink to={packPath(path)} className="text-link hover:underline">
            {meta.name}
          </AppLink>
        </p>
        <h1 className="mb-4 font-serif text-2xl font-bold">
          {editing ? `Edit ${editing.name}` : `New ${label}`}
        </h1>
        {editor[kind]}
      </div>
    );
  }

  const groups = new Map<string, typeof entries>();
  for (const e of entries) groups.set(e.type, [...(groups.get(e.type) ?? []), e]);
  const deleteEntry = (type: string, entryName: string) => {
    const json =
      type === 'class'
        ? removeClass(pack.json, entryName)
        : putFluffImage(removeEntry(pack.json, type, entryName), type, entryName, null);
    void savePack(path, json);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <p className="text-sm">
        <AppLink to="/homebrew" className="text-link hover:underline">
          Homebrew
        </AppLink>
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <Cover
          cover={packCover(pack.json)}
          onChange={(cover) => {
            void savePack(path, setPackCover(pack.json, cover));
          }}
          onError={setMessage}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-serif text-2xl font-bold">{meta.name}</h1>
            <p className="text-sm text-muted">
              Source {meta.id} · {meta.edition} rules{meta.author ? ` · by ${meta.author}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
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
        {KINDS.map((k, i) => (
          <Button
            key={k.type}
            variant={i === 0 ? 'primary' : 'secondary'}
            onClick={() => {
              navigate(`${packPath(path)}?new=${k.type}`);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> New {k.label}
          </Button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">Nothing in this pack yet.</p>
      ) : (
        [...groups]
          .sort(([a], [b]) => order(a) - order(b))
          .map(([type, list]) => (
            <section key={type} aria-label={plural(typeLabel(type), 2)}>
              <h2 className="mb-2 font-serif text-lg font-bold">
                {plural(typeLabel(type), 2)}{' '}
                <span className="text-sm font-normal text-faint">{list.length}</span>
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {list.map((e) => (
                  <li key={e.name}>
                    <EntryRow
                      pack={pack.json}
                      meta={meta}
                      type={e.type}
                      name={e.name}
                      entity={e.entity}
                      confirming={confirm === `${e.type}:${e.name}`}
                      onEdit={
                        isKind(e.type)
                          ? () => {
                              navigate(
                                `${packPath(path)}?edit=${encodeURIComponent(`${e.type}:${e.name}`)}`,
                              );
                            }
                          : null
                      }
                      onDelete={() => {
                        setConfirm(`${e.type}:${e.name}`);
                      }}
                      onConfirm={(yes) => {
                        setConfirm(null);
                        if (yes) deleteEntry(e.type, e.name);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}

/** The pack's cover, like a book's: pick a picture, change it or take it off. */
function Cover({
  cover,
  onChange,
  onError,
}: {
  cover: string | null;
  onChange: (cover: string | null) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="w-28 shrink-0 space-y-1">
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-border bg-sunken">
        {cover ? (
          <img src={cover} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <BookOpen className="h-8 w-8 text-faint" aria-hidden />
        )}
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-link hover:bg-sunken">
        <ImagePlus className="h-3.5 w-3.5" aria-hidden /> {cover ? 'Change cover' : 'Add a cover'}
        <input
          type="file"
          accept="image/*"
          aria-label="Cover file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            shrinkImage(file, 600).then(onChange, (error: unknown) => {
              onError(error instanceof Error ? error.message : String(error));
            });
          }}
        />
      </label>
      {cover && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
          }}
          className="block w-full rounded-md py-0.5 text-xs text-muted hover:bg-sunken"
        >
          Remove cover
        </button>
      )}
    </div>
  );
}

/** One entry as a compendium row: its name links to its page; open it to read it here. */
function EntryRow({
  pack,
  meta,
  type,
  name,
  entity,
  confirming,
  onEdit,
  onDelete,
  onConfirm,
}: {
  pack: RawEntity;
  meta: PackMeta;
  type: string;
  name: string;
  entity: RawEntity;
  confirming: boolean;
  onEdit: (() => void) | null;
  onDelete: () => void;
  onConfirm: (yes: boolean) => void;
}) {
  const image = WITH_PICTURE.has(type) ? fluffImage(pack, type, name) : null;
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} ${name}`}
          onClick={() => {
            setOpen(!open);
          }}
          className="rounded p-1 text-faint hover:bg-sunken"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
            aria-hidden
          />
        </button>
        {image && <img src={image} alt="" className="h-8 w-8 rounded object-cover" />}
        <AppLink
          to={entityPath(makeKey(type, [name], meta.id))}
          className="min-w-0 flex-1 truncate font-medium text-link hover:underline"
        >
          {name}
        </AppLink>
        {confirming ? (
          <>
            <span className="text-sm">Delete it?</span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onConfirm(true);
              }}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onConfirm(false);
              }}
            >
              Keep
            </Button>
          </>
        ) : (
          <>
            {onEdit && (
              <Button size="sm" variant="ghost" aria-label={`Edit ${name}`} onClick={onEdit}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button size="sm" variant="ghost" aria-label={`Delete ${name}`} onClick={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
      {open && (
        <div className="flex gap-4 border-t border-border px-4 py-3">
          {image && (
            <img
              src={image}
              alt=""
              className="hidden max-h-48 w-40 shrink-0 rounded-md object-contain sm:block"
            />
          )}
          <div className="min-w-0 flex-1">
            {type === 'class' ? (
              <ClassSummary entity={entity} features={classFeatures(pack, name)} />
            ) : (
              <EntityView type={type} data={entity} edition={meta.edition} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ClassSummary({ entity, features }: { entity: RawEntity; features: readonly RawEntity[] }) {
  const hd = entity.hd as { faces?: number } | undefined;
  return (
    <div className="space-y-2 text-sm">
      {hd?.faces !== undefined && (
        <p>
          <strong>Hit die:</strong> d{hd.faces}
        </p>
      )}
      {[...features]
        .sort((a, b) => Number(a.level) - Number(b.level))
        .map((f, i) => (
          <section key={i}>
            <h3 className="font-serif font-bold">
              <span className="text-muted">Level {String(f.level)}: </span>
              {String(f.name)}
            </h3>
            <Entries entries={f.entries} />
          </section>
        ))}
    </div>
  );
}
