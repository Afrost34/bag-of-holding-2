import { cn } from '@boh/ui';
import { ArtImage } from '../ArtImage';
import { picturePathOf } from '../pictures/model';
import { LibraryPicture } from '../pictures/PictureLibrary';
import type { CharacterFile } from './model';

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
  const library = picturePathOf(p);
  if (library)
    return (
      <LibraryPicture
        path={library}
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
