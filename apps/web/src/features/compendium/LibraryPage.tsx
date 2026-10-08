import type { BookSummary } from '@boh/data5e';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@boh/ui';
import { AppLink } from '../../app/AppLink';
import { ArtImage } from '../../app/ArtImage';
import { useLibrary } from '../../app/data/books';
import { readerPath } from '../../app/renderer/referenceTarget';
import { usePageTitle } from '../../app/tabs/usePageTitle';

const BOOK_GROUPS: [string, string][] = [
  ['core', 'Core rules'],
  ['supplement', 'Supplements'],
  ['setting', 'Campaign settings'],
  ['supplement-alt', 'Other supplements'],
  ['setting-alt', 'Other settings'],
  ['homebrew', 'Homebrew'],
  ['other', 'Other'],
];

function groupBooks(kind: 'book' | 'adventure', books: BookSummary[]): [string, BookSummary[]][] {
  if (kind === 'adventure') {
    // Adventures by storyline, the newest storyline first.
    const groups = new Map<string, BookSummary[]>();
    for (const b of books) {
      const key = b.storyline ?? 'Other adventures';
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }
    return [...groups.entries()];
  }
  const known = new Set(BOOK_GROUPS.map(([id]) => id));
  return BOOK_GROUPS.map(([id, label]): [string, BookSummary[]] => [
    label,
    books.filter((b) =>
      id === 'other' ? !known.has(b.group) || b.group === 'other' : b.group === id,
    ),
  ]).filter(([, list]) => list.length > 0);
}

type Show = 'all' | 'book' | 'adventure';

/** Books and adventures together, grouped; a switch narrows to one kind. */
export function LibraryPage({ initial = 'all' }: { initial?: Show }) {
  const books = useLibrary('book');
  const adventures = useLibrary('adventure');
  const [show, setShow] = useState<Show>(initial);
  const [filter, setFilter] = useState('');
  usePageTitle('Books');
  const match = (b: BookSummary) => b.name.toLowerCase().includes(filter.trim().toLowerCase());
  const sections: { kind: 'book' | 'adventure'; label: string; list: BookSummary[] }[] = [
    ...(show !== 'adventure'
      ? groupBooks('book', (books ?? []).filter(match)).map(([label, list]) => ({
          kind: 'book' as const,
          label,
          list,
        }))
      : []),
    ...(show !== 'book'
      ? groupBooks('adventure', (adventures ?? []).filter(match)).map(([label, list]) => ({
          kind: 'adventure' as const,
          label: show === 'all' ? `Adventures: ${label}` : label,
          list,
        }))
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <AppLink to="/compendium" aria-label="Compendium" className="text-muted hover:text-text">
          <ArrowLeft className="h-5 w-5" />
        </AppLink>
        <h1 className="font-serif text-2xl font-bold">Books</h1>
        <div
          role="radiogroup"
          aria-label="Show"
          className="flex rounded-md border border-border p-0.5 text-sm"
        >
          {(
            [
              ['all', 'All'],
              ['book', 'Books'],
              ['adventure', 'Adventures'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={show === id}
              onClick={() => {
                setShow(id);
              }}
              className={cn(
                'rounded px-2.5 py-1 font-medium',
                show === id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <input
          type="search"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
          placeholder="Filter books"
          aria-label="Filter books"
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm sm:w-64"
        />
      </header>
      {(books === null || adventures === null) && <p className="text-muted">Loading…</p>}
      {sections.map(({ kind, label, list }) => (
        <section key={`${kind}-${label}`} aria-label={label} className="mb-8">
          <h2 className="mb-3 border-b border-border pb-1 font-serif text-lg font-bold">{label}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.map((b) => (
              <li key={b.id}>
                <AppLink to={readerPath(kind, b.id)} className="group block">
                  <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-sunken shadow-card transition-transform group-hover:-translate-y-0.5">
                    {b.coverPath ? (
                      <ArtImage
                        path={b.coverPath}
                        widths={[240, 400]}
                        sizes="(min-width: 1024px) 180px, 45vw"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center font-serif font-bold text-muted">
                        {b.name}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium group-hover:text-link">
                    {b.name}
                  </p>
                  <p className="text-xs text-muted">
                    {b.published?.slice(0, 4)}
                    {b.levels && ` · Levels ${b.levels}`}
                  </p>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
