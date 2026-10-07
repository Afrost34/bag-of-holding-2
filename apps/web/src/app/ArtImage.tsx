import { useState, type ImgHTMLAttributes } from 'react';
import { imageSrcSet, originalImageUrl, resizedImageUrl } from './images';

export interface ArtImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes'
> {
  /** 5etools image path, e.g. `classes/XPHB/Fighter.webp`. */
  path: string;
  /** Widths to offer, smallest first; the browser picks one for the screen and `sizes`. */
  widths: readonly number[];
  /** How wide the image is shown, e.g. `(min-width: 640px) 224px, 100vw`. */
  sizes: string;
}

/**
 * A 5etools image in a size close to how it is shown, loaded lazily and decoded off the main
 * thread. Falls back to the full-size original if the resized copy cannot be loaded.
 */
export function ArtImage({ path, widths, sizes, alt = '', ...rest }: ArtImageProps) {
  const [failed, setFailed] = useState(false);
  const largest = widths.at(-1) ?? 640;
  return failed ? (
    <img src={originalImageUrl(path)} alt={alt} loading="lazy" decoding="async" {...rest} />
  ) : (
    <img
      src={resizedImageUrl(path, largest)}
      srcSet={imageSrcSet(path, widths)}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true);
      }}
      {...rest}
    />
  );
}
