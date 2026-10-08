import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchPalette } from './store';

const SearchPalette = lazy(() =>
  import('./SearchPalette').then((m) => ({ default: m.SearchPalette })),
);

/**
 * The search palette, loaded the first time it opens (it brings the journal's code with it,
 * which the first screen does not need). Ctrl/Cmd+K toggles it from anywhere.
 */
export function LazySearchPalette() {
  const open = useSearchPalette((s) => s.open);
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const s = useSearchPalette.getState();
        s.setOpen(!s.open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <SearchPalette />
    </Suspense>
  );
}
