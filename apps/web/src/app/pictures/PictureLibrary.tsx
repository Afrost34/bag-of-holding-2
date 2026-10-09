import { cn } from '@boh/ui';
import { useEffect, useState, type CSSProperties } from 'react';
import { pictureName } from './model';
import { usePictures } from './store';
import { usePictureUrl } from './usePictureUrl';

/** A library picture. */
export function LibraryPicture({
  path,
  alt,
  className,
  style,
}: {
  path: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const url = usePictureUrl(path);
  return url ? (
    <img src={url} alt={alt} className={className} style={style} />
  ) : (
    <span aria-label={alt} role="img" className={cn('bg-sunken', className)} style={style} />
  );
}

/**
 * The picture library as a grid to pick from: every picture imported for a character or an NPC,
 * whatever it was imported for.
 */
export function PictureLibrary({
  selected,
  onPick,
}: {
  /** The path shown as chosen. */
  selected?: string | null;
  onPick: (path: string) => void;
}) {
  const { pictures, loaded, load } = usePictures();
  const [filter, setFilter] = useState('');
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const shown = pictures.filter((p) =>
    pictureName(p).toLowerCase().includes(filter.trim().toLowerCase()),
  );
  if (loaded && pictures.length === 0)
    return (
      <p className="text-sm text-muted">
        Pictures you upload for characters and NPCs are kept here, to use again.
      </p>
    );
  return (
    <div className="space-y-2">
      {pictures.length > 8 && (
        <input
          type="search"
          value={filter}
          aria-label="Find a picture"
          placeholder="Picture name…"
          onChange={(e) => {
            setFilter(e.target.value);
          }}
          className="w-48 rounded-md border border-border bg-surface px-2 py-1 text-sm"
        />
      )}
      <ul aria-label="Your pictures" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((path) => (
          <li key={path}>
            <button
              type="button"
              aria-label={`Use ${pictureName(path)}`}
              title={pictureName(path)}
              onClick={() => {
                onPick(path);
              }}
              className={cn(
                'block aspect-square w-full overflow-hidden rounded border-2',
                selected === path ? 'border-accent' : 'border-transparent hover:border-accent',
              )}
            >
              <LibraryPicture
                path={path}
                alt=""
                className="h-full w-full object-cover object-top"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
