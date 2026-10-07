import { Star, X } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '../AppLink';
import { useAnnotations } from './store';

/** The user's bookmarks as a row of links, newest first. Hidden when there are none. */
export function BookmarkList() {
  const { bookmarks, load } = useAnnotations();
  const toggleBookmark = useAnnotations((s) => s.toggleBookmark);
  useEffect(() => {
    void load();
  }, [load]);
  if (bookmarks.length === 0) return null;
  return (
    <nav aria-label="Bookmarks" className="mt-8">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Bookmarks</h2>
      <ul className="flex flex-wrap gap-2">
        {bookmarks.map((b) => (
          <li
            key={b.path}
            className="flex items-center rounded-md border border-border bg-surface text-sm hover:border-accent"
          >
            <AppLink
              to={b.path}
              className="flex items-center gap-1.5 py-1.5 pr-1 pl-2.5 font-medium"
            >
              <Star className="h-3.5 w-3.5 fill-current text-accent" aria-hidden />
              {b.label}
            </AppLink>
            <button
              type="button"
              aria-label={`Remove bookmark ${b.label}`}
              onClick={() => {
                toggleBookmark(b.path, b.label);
              }}
              className="px-1.5 py-1.5 text-faint hover:text-text"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
