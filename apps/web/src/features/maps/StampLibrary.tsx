import { Button, cn } from '@boh/ui';
import { FolderOpen, Globe, ImagePlus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fileUrl, findStamps, stampFile, useStamps, type Stamp } from '../../app/maps/assets';
import { OnlineStamps } from './OnlineStamps';

/**
 * The stamp library: pictures imported from folders (sub-folders become categories) or added from
 * packs online, searched by
 * name, folder or tag. Picking one starts the stamp tool with it.
 */
export function StampLibrary({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (path: string, aspect: number) => void;
}) {
  const { stamps, tags, importFiles, setTags } = useStamps();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const categories = [...new Set(stamps.flatMap((s) => prefixes(s.category)))].sort();
  const shown = findStamps(stamps, tags, query, category).slice(0, 300);
  const picked = stamps.find((s) => s.path === selected);

  const pick = (folder: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    if (folder) input.setAttribute('webkitdirectory', '');
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      if (files.length === 0) return;
      setBusy(true);
      void importFiles(files)
        .then((n) => {
          setMessage(`${String(n)} stamp${n === 1 ? '' : 's'} added.`);
        })
        .finally(() => {
          setBusy(false);
        });
    };
    input.click();
  };

  return (
    <section aria-label="Stamps" className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            pick(true);
          }}
        >
          <FolderOpen className="h-4 w-4" aria-hidden /> {busy ? 'Importing…' : 'Import a folder'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            pick(false);
          }}
        >
          <ImagePlus className="h-4 w-4" aria-hidden /> Pictures
        </Button>
        <Button
          variant="ghost"
          aria-expanded={online}
          onClick={() => {
            setOnline(!online);
          }}
        >
          <Globe className="h-4 w-4" aria-hidden /> Find online
        </Button>
      </div>
      {online && <OnlineStamps onPick={onPick} />}
      {message && (
        <p role="status" className="text-xs text-muted">
          {message}
        </p>
      )}
      {stamps.length === 0 ? (
        <p className="text-sm text-muted">
          No stamps yet. Import a folder of pictures (PNG with transparency works best): its
          sub-folders become categories.
        </p>
      ) : (
        <>
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              aria-label="Find a stamp"
              placeholder="Tree, door, rubble…"
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-surface py-1.5 pr-2 pl-8 text-sm"
            />
          </label>
          {categories.length > 0 && (
            <select
              value={category}
              aria-label="Stamp category"
              onChange={(e) => {
                setCategory(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {'  '.repeat(c.split('/').length - 1)}
                  {c.split('/').pop()}
                </option>
              ))}
            </select>
          )}
          <ul aria-label="Stamp pictures" className="grid grid-cols-4 gap-1">
            {shown.map((s) => (
              <StampTile key={s.path} stamp={s} active={s.path === selected} onPick={onPick} />
            ))}
          </ul>
          {picked && (
            <label className="block text-sm">
              Tags for {picked.name}
              <input
                key={picked.path}
                defaultValue={(tags[picked.path] ?? []).join(', ')}
                aria-label="Stamp tags"
                placeholder="forest, tree"
                onBlur={(e) => {
                  void setTags(
                    picked.path,
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  );
                }}
                className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
              />
            </label>
          )}
        </>
      )}
    </section>
  );
}

/** `a/b/c` → `a`, `a/b`, `a/b/c`. */
function prefixes(category: string): string[] {
  if (!category) return [];
  const parts = category.split('/');
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

function StampTile({
  stamp,
  active,
  onPick,
}: {
  stamp: Stamp;
  active: boolean;
  onPick: (path: string, aspect: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    let live = true;
    void fileUrl(stampFile(stamp.path)).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [stamp.path]);
  return (
    <li>
      <button
        type="button"
        aria-label={stamp.name}
        aria-pressed={active}
        title={stamp.category ? `${stamp.name} · ${stamp.category}` : stamp.name}
        onClick={() => {
          onPick(stamp.path, aspect);
        }}
        className={cn(
          'flex aspect-square w-full items-center justify-center rounded border bg-sunken p-1',
          active ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent',
        )}
      >
        {url && (
          <img
            src={url}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight)
                setAspect(img.naturalWidth / img.naturalHeight);
            }}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </button>
    </li>
  );
}
