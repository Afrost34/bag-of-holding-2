import { makeKey } from '@boh/data5e';
import { Button, cn } from '@boh/ui';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArtImage } from '../../app/ArtImage';
import type { CharacterFile } from '../../app/characters/model';
import { loadEntity } from '../../app/data/entities';
import { loadRows } from '../../app/data/lists';
import type { CharacterView } from '../../app/data/protocol';
import { shrinkImage } from '../../app/shrinkImage';

/** A character's picture, or its initial when it has none. */
export function PortraitImage({
  character,
  size,
  className,
}: {
  character: CharacterFile;
  size: number;
  className?: string;
}) {
  const p = character.portrait;
  const style = { width: size, height: size };
  if (p?.startsWith('art:'))
    return (
      <ArtImage
        path={p.slice(4)}
        widths={[192, 384]}
        sizes={`${String(size)}px`}
        alt={`Portrait of ${character.name}`}
        style={style}
        className={cn('shrink-0 rounded object-cover object-top', className)}
      />
    );
  if (p?.startsWith('data:'))
    return (
      <img
        src={p}
        alt={`Portrait of ${character.name}`}
        style={style}
        className={cn('shrink-0 rounded object-cover object-top', className)}
      />
    );
  return (
    <span
      style={style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded border-2 border-dashed border-border bg-sunken font-serif text-2xl font-bold',
        className,
      )}
      aria-hidden
    >
      {character.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** The portrait in the builder's header: click to change it. */
export function PortraitButton({
  character,
  view,
  save,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  save: (c: CharacterFile) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Change portrait"
        onClick={() => {
          setOpen(true);
        }}
        className="shrink-0 rounded hover:ring-2 hover:ring-accent"
      >
        <PortraitImage character={character} size={56} />
      </button>
      {open && (
        <PortraitDialog
          character={character}
          view={view}
          save={save}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Art for a character from its species, class, subclass and background (5etools fluff images). */
function useDataArt(view: CharacterView | null): string[] {
  const [paths, setPaths] = useState<string[]>([]);
  const ids = (view?.entities ?? [])
    .filter((e) => ['race', 'subrace', 'class', 'subclass', 'background'].includes(e.type))
    .map((e) => makeKey(`${e.type}Fluff`, [e.name], e.source))
    .join('\n');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (ids ? ids.split('\n') : []).map(async (k) => {
        const fluff = await loadEntity(k);
        const images = Array.isArray(fluff?.data.images) ? (fluff.data.images as unknown[]) : [];
        return images.flatMap((img) => {
          const href = typeof img === 'object' && img !== null && 'href' in img ? img.href : null;
          // A 5etools image (its path) or a homebrew one (its address).
          const path =
            typeof href === 'object' && href !== null
              ? 'path' in href
                ? href.path
                : 'url' in href
                  ? href.url
                  : undefined
              : undefined;
          return typeof path === 'string' ? [path] : [];
        });
      }),
    ).then((lists) => {
      if (!cancelled) setPaths([...new Set(lists.flat())]);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);
  return paths;
}

/** The card art of every class, subclass and species (homebrew too), by name. */
function useAllArt(): { name: string; path: string }[] {
  const [art, setArt] = useState<{ name: string; path: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(['species', 'classes', 'subclasses'].map((c) => loadRows(c))).then((lists) => {
      if (cancelled) return;
      const seen = new Set<string>();
      setArt(
        lists.flat().flatMap((r) => {
          const path = r.card?.image;
          if (!path || seen.has(path) || r.legacy) return [];
          seen.add(path);
          return [{ name: r.name, path }];
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return art;
}

function PortraitDialog({
  character,
  view,
  save,
  onClose,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  save: (c: CharacterFile) => void;
  onClose: () => void;
}) {
  const art = useDataArt(view);
  const all = useAllArt();
  const [filter, setFilter] = useState('');
  const shown = all.filter((a) => a.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (portrait: string | undefined) => {
    const { portrait: _old, ...rest } = character;
    save(portrait ? { ...rest, portrait } : rest);
    onClose();
  };
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Portrait"
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center bg-header px-4 py-3 text-header-fg">
          <h2 className="flex-1 font-serif text-lg font-bold uppercase">Portrait</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 hover:bg-black/20"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-3">
            <PortraitImage character={character} size={96} />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload a picture
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Portrait file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file)
                    void shrinkImage(file)
                      .then((url) => {
                        set(url);
                      })
                      .catch(() => {
                        setProblem('This picture could not be read.');
                      });
                }}
              />
            </label>
            {character.portrait && (
              <Button
                variant="ghost"
                onClick={() => {
                  set(undefined);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Button>
            )}
          </div>
          {problem && (
            <p role="alert" className="text-sm text-accent-ink">
              {problem}
            </p>
          )}
          <div>
            <h3 className="mb-2 font-bold">Or pick art from your books</h3>
            {art.length === 0 ? (
              <p className="text-sm text-muted">
                Choose a species, class or background to see their art here.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {art.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      aria-label={`Use ${path.split('/').pop() ?? path}`}
                      onClick={() => {
                        set(`art:${path}`);
                      }}
                      className={cn(
                        'block aspect-square w-full overflow-hidden rounded border-2',
                        character.portrait === `art:${path}`
                          ? 'border-accent'
                          : 'border-transparent hover:border-accent',
                      )}
                    >
                      <ArtImage
                        path={path}
                        widths={[192, 384]}
                        sizes="160px"
                        className="h-full w-full object-cover object-top"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="flex-1 font-bold">All character art</h3>
              <input
                type="search"
                value={filter}
                aria-label="Find art"
                placeholder="Elf, Wizard…"
                onChange={(e) => {
                  setFilter(e.target.value);
                }}
                className="w-48 rounded-md border border-border bg-surface px-2 py-1 text-sm"
              />
            </div>
            <ul aria-label="All character art" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {shown.map(({ name, path }) => (
                <li key={path}>
                  <button
                    type="button"
                    aria-label={`Use ${name}`}
                    title={name}
                    onClick={() => {
                      set(`art:${path}`);
                    }}
                    className={cn(
                      'block aspect-square w-full overflow-hidden rounded border-2',
                      character.portrait === `art:${path}`
                        ? 'border-accent'
                        : 'border-transparent hover:border-accent',
                    )}
                  >
                    <ArtImage
                      path={path}
                      widths={[192, 384]}
                      sizes="160px"
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
