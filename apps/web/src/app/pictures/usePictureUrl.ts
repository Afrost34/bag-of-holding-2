import { useEffect, useState } from 'react';
import { fileUrl } from '../maps/assets';

/** A library picture's URL (undefined while it loads, null when it is missing). */
export function usePictureUrl(path: string | null): string | null | undefined {
  const [state, setState] = useState<{ for: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    void fileUrl(path).then((url) => {
      if (live) setState({ for: path, url });
    });
    return () => {
      live = false;
    };
  }, [path]);
  if (!path) return null;
  return state?.for === path ? state.url : undefined;
}
