import { Button, cn } from '@boh/ui';
import { Download, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStamps } from '../../app/maps/assets';
import {
  findIcons,
  iconLabel,
  iconSvg,
  loadPack,
  ONLINE_PACKS,
  packDownloaded,
  STAMP_STYLES,
  svgDataUrl,
  svgToPng,
  type IconSet,
} from '../../app/maps/onlineStamps';

/**
 * Stamps from packs online: download a pack once, search it, and add the icons wanted to the
 * stamp library (as pictures in the pack's folder), in a colour of the DM's choosing.
 */
export function OnlineStamps({ onPick }: { onPick: (path: string, aspect: number) => void }) {
  const pack = ONLINE_PACKS[0];
  const addPictures = useStamps((s) => s.addPictures);
  const [set, setSet] = useState<IconSet | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<(typeof STAMP_STYLES)[number]['id']>('ink');
  const [added, setAdded] = useState<string | null>(null);
  const look = STAMP_STYLES.find((s) => s.id === style) ?? STAMP_STYLES[0];

  const open = useCallback(() => {
    if (!pack) return;
    setState('loading');
    loadPack(pack).then(
      (s) => {
        setSet(s);
        setState('idle');
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      },
    );
  }, [pack]);
  // A pack downloaded before opens by itself (from the browser's cache, offline too).
  useEffect(() => {
    if (!pack) return;
    void packDownloaded(pack).then((downloaded) => {
      if (downloaded) open();
    });
  }, [pack, open]);
  const found = useMemo(() => (set ? findIcons(set, query, 96) : []), [set, query]);
  if (!pack) return null;

  const add = async (names: readonly string[]) => {
    if (!set || names.length === 0) return;
    const folder = `${pack.folder}/${look.name}`;
    const pictures = await Promise.all(
      names.map(async (name) => ({
        path: `${folder}/${name}.png`,
        bytes: await svgToPng(iconSvg(set, name, look.color, look.outline)),
      })),
    );
    await addPictures(pictures);
    setAdded(
      names.length === 1
        ? `Added “${iconLabel(names[0] ?? '')}” to your stamps.`
        : `Added ${String(names.length)} stamps to your stamps.`,
    );
    if (names.length === 1) onPick(`${folder}/${names[0] ?? ''}.png`, 1);
  };

  return (
    <section aria-label="Stamps online" className="space-y-2 rounded-md border border-border p-2">
      <h3 className="font-serif text-sm font-bold">{pack.name}</h3>
      <p className="text-xs text-muted">{pack.about}</p>
      <p className="text-xs text-faint">
        {pack.credit}.{' '}
        <a href={pack.licenseUrl} target="_blank" rel="noreferrer" className="text-link underline">
          {pack.license}
        </a>
      </p>
      {!set ? (
        <>
          <Button variant="primary" disabled={state === 'loading'} onClick={open}>
            <Download className="h-4 w-4" aria-hidden />{' '}
            {state === 'loading' ? 'Downloading…' : `Download the pack (${pack.size}, once)`}
          </Button>
          {error && (
            <p role="alert" className="text-xs text-accent-ink">
              {error}
            </p>
          )}
        </>
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
              aria-label="Find stamps online"
              placeholder="Castle, tree, chest, skull…"
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-surface py-1.5 pr-2 pl-8 text-sm"
            />
          </label>
          <div role="radiogroup" aria-label="Stamp colour" className="flex flex-wrap gap-1">
            {STAMP_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                aria-label={s.name}
                title={s.name}
                onClick={() => {
                  setStyle(s.id);
                }}
                className={cn(
                  'h-6 w-6 rounded-full border-2',
                  style === s.id ? 'border-accent' : 'border-border',
                )}
                style={{ background: s.color }}
              />
            ))}
          </div>
          {added && (
            <p role="status" className="text-xs text-muted">
              {added}
            </p>
          )}
          <ul
            aria-label="Online stamps"
            className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto"
          >
            {found.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  aria-label={`Add ${iconLabel(name)}`}
                  title={iconLabel(name)}
                  onClick={() => {
                    void add([name]);
                  }}
                  className="flex aspect-square w-full items-center justify-center rounded border border-border bg-sunken p-1 hover:border-accent"
                >
                  <img
                    src={svgDataUrl(iconSvg(set, name, look.color, look.outline))}
                    alt=""
                    loading="lazy"
                    className="max-h-full max-w-full"
                  />
                </button>
              </li>
            ))}
          </ul>
          {query.trim() && found.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => {
                void add(found);
              }}
            >
              Add all {found.length} shown
            </Button>
          )}
        </>
      )}
    </section>
  );
}
