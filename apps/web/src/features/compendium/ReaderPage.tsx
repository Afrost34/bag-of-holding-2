import { areaIndex, headerKey, headerKeys, type BookContent, type BookKind } from '@boh/data5e';
import { Entries, RendererProvider, type RendererServices } from '@boh/renderer';
import { Button, cn, IconButton } from '@boh/ui';
import { ArrowLeft, ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { chapterNoteId } from '../../app/annotations/model';
import { PageTools } from '../../app/annotations/PageTools';
import { AppLink } from '../../app/AppLink';
import { useAppNavigate } from '../../app/navigation';
import { useBookContent } from '../../app/data/books';
import { scrollToElement } from '../../app/scroll';
import { readerPath, referencePath } from '../../app/renderer/referenceTarget';
import { usePageTitle } from '../../app/tabs/usePageTitle';

function readerTarget(book: BookContent, target: ReaderSearch): string {
  const base = readerPath(book.kind, book.id, target.ch, target.h);
  if (!target.area) return base;
  return `${base}${base.includes('?') ? '&' : '?'}area=${encodeURIComponent(target.area)}`;
}

export interface ReaderSearch {
  ch?: string | undefined;
  h?: string | undefined;
  area?: string | undefined;
}

/** Scrolls to a contents header (nth occurrence) or an area id inside the chapter container. */
function scrollToTarget(container: HTMLElement, search: ReaderSearch, headerIndex: number): void {
  let target: Element | null = null;
  if (search.area) target = container.querySelector(`[id="${CSS.escape(search.area)}"]`);
  if (!target && search.h) {
    const keys = headerKeys(search.h);
    const matches = [...container.querySelectorAll('[data-title]')].filter((el) =>
      keys.includes(headerKey(el.getAttribute('data-title') ?? '')),
    );
    target = matches[headerIndex] ?? matches[0] ?? null;
  }
  if (target) {
    scrollToElement(target);
    target.classList.add('boh-flash');
    setTimeout(() => {
      target.classList.remove('boh-flash');
    }, 1600);
  } else {
    scrollToElement(container.parentElement ?? container, { offset: 0 });
  }
}

/** Which occurrence of a header the contents meant (headers can repeat within a chapter). */
function headerIndexFor(
  book: BookContent,
  chapterIndex: number,
  header: string | undefined,
): number {
  if (!header) return 0;
  const keys = headerKeys(header);
  return (
    book.toc[chapterIndex]?.headers.find((x) => keys.includes(headerKey(x.header)))?.index ?? 0
  );
}

export function ReaderPage({
  kind,
  id,
  search,
}: {
  kind: BookKind;
  id: string;
  search: ReaderSearch;
}) {
  const state = useBookContent(kind, id);
  const book = state.status === 'found' ? state.book : null;
  usePageTitle(book?.name);

  if (state.status === 'loading') return <p className="p-8 text-muted">Loading…</p>;
  if (!book) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Not found</h1>
        <p className="mt-2 text-muted">
          This book isn&apos;t in your data, or its source is turned off.
        </p>
      </div>
    );
  }
  return <Reader key={`${kind}:${book.id}`} book={book} search={search} />;
}

function Reader({ book, search }: { book: BookContent; search: ReaderSearch }) {
  const navigate = useAppNavigate();
  const chapterIndex = Math.min(
    Math.max(0, Number(search.ch ?? 0) || 0),
    Math.max(0, book.chapters.length - 1),
  );
  const chapter = book.chapters[chapterIndex];
  const contentRef = useRef<HTMLDivElement>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const areas = useMemo(() => areaIndex(book.chapters), [book]);

  const go = (next: ReaderSearch) => {
    const path = readerTarget(book, next);
    // Same URL (the reader scrolled away since): scroll again rather than navigate.
    if (path === readerTarget(book, search) && contentRef.current) {
      scrollToTarget(contentRef.current, next, headerIndexFor(book, chapterIndex, next.h));
    } else {
      navigate(path);
    }
    setTocOpen(false);
  };

  // Which occurrence of the header the contents meant (headers can repeat within a chapter).
  const { h, area } = search;
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    // Wait a frame so the chapter is laid out before scrolling.
    const frame = requestAnimationFrame(() => {
      scrollToTarget(container, { h, area }, headerIndexFor(book, chapterIndex, h));
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [book, chapterIndex, h, area]);

  // Area links ({@area}) point at entry ids inside this book.
  const services: Partial<RendererServices> = useMemo(
    () => ({
      ReferenceLink: function BookReferenceLink({
        reference,
        children,
      }: ComponentProps<RendererServices['ReferenceLink']>) {
        if (reference.ref !== 'area') {
          return <ReferenceFallback reference={reference}>{children}</ReferenceFallback>;
        }
        const areaId = reference.args[1] ?? '';
        const ch = areas.get(areaId);
        if (ch === undefined) return <span>{children}</span>;
        return (
          <AppLink
            to={readerTarget(book, { ch: String(ch), area: areaId })}
            onClick={() => {
              // Already on this chapter: scroll now, even when the URL doesn't change.
              if (contentRef.current?.querySelector(`[id="${CSS.escape(areaId)}"]`)) {
                scrollToTarget(contentRef.current, { area: areaId }, 0);
              }
            }}
            className="font-medium text-link hover:underline"
          >
            {children}
          </AppLink>
        );
      },
    }),
    [areas, book],
  );

  const toc = (
    <nav aria-label="Contents" className="space-y-0.5 p-3 text-sm">
      <p className="mb-2 font-serif font-bold">{book.name}</p>
      {book.toc.map((c, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => {
              go({ ch: String(i) });
            }}
            aria-current={i === chapterIndex ? 'true' : undefined}
            className={cn(
              'block w-full rounded px-2 py-1 text-left hover:bg-sunken',
              i === chapterIndex && 'bg-accent-soft font-semibold text-accent-ink',
            )}
          >
            {c.ordinal && <span className="text-xs text-muted">{c.ordinal} · </span>}
            {c.name}
          </button>
          {i === chapterIndex && c.headers.length > 0 && (
            <ul className="mb-1 ml-3 border-l border-border">
              {c.headers.map((h, j) => (
                <li key={j}>
                  <button
                    type="button"
                    onClick={() => {
                      go({ ch: String(i), h: h.header });
                    }}
                    className="block w-full truncate rounded px-2 py-0.5 text-left text-muted hover:bg-sunken hover:text-text"
                    style={{ paddingLeft: `${String(0.5 + h.depth * 0.75)}rem` }}
                  >
                    {h.header.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">
        {toc}
      </aside>
      {tocOpen && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-surface lg:hidden">
          <div className="flex justify-end p-2">
            <IconButton
              label="Close contents"
              icon={<X className="h-5 w-5" />}
              onClick={() => {
                setTocOpen(false);
              }}
            />
          </div>
          {toc}
        </div>
      )}
      <div
        data-scroll-memory="reader"
        className="min-w-0 flex-1 overflow-y-auto after:block after:h-16 after:content-['']"
      >
        <div className="mx-auto max-w-3xl px-4 py-4 md:px-8">
          <div className="mb-2 flex items-center gap-2">
            <AppLink
              to={`/compendium/library/${book.kind === 'adventure' ? 'adventures' : 'books'}`}
              aria-label="Library"
              className="text-muted hover:text-text"
            >
              <ArrowLeft className="h-5 w-5" />
            </AppLink>
            <span className="truncate text-sm text-muted">{book.name}</span>
            <span className="flex-1" />
            <Button
              size="sm"
              className="lg:hidden"
              onClick={() => {
                setTocOpen(true);
              }}
            >
              <List className="h-4 w-4" aria-hidden /> Contents
            </Button>
          </div>
          <div className="mb-4">
            <PageTools
              noteId={chapterNoteId(book.kind, book.id, chapterIndex)}
              label={`${book.name}: ${book.toc[chapterIndex]?.name ?? ''}`}
            />
          </div>
          <article ref={contentRef} className="text-[15px] leading-relaxed">
            <RendererProvider services={services}>
              {chapter !== undefined ? (
                <Entries entries={[chapter]} depth={0} />
              ) : (
                <p className="text-muted">Empty chapter.</p>
              )}
            </RendererProvider>
          </article>
          <nav
            aria-label="Chapters"
            className="mt-8 flex justify-between border-t border-border pt-4"
          >
            {chapterIndex > 0 ? (
              <Button
                variant="ghost"
                onClick={() => {
                  go({ ch: String(chapterIndex - 1) });
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />{' '}
                {book.toc[chapterIndex - 1]?.name ?? 'Previous'}
              </Button>
            ) : (
              <span />
            )}
            {chapterIndex < book.chapters.length - 1 && (
              <Button
                variant="ghost"
                onClick={() => {
                  go({ ch: String(chapterIndex + 1) });
                }}
              >
                {book.toc[chapterIndex + 1]?.name ?? 'Next'}{' '}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

/** Non-area references inside a book use the app-wide targets. */
function ReferenceFallback({
  reference,
  children,
}: ComponentProps<RendererServices['ReferenceLink']>) {
  const path = referencePath(reference.ref, reference.args);
  if (!path) return <span>{children}</span>;
  return (
    <AppLink to={path} className="font-medium text-link hover:underline">
      {children}
    </AppLink>
  );
}
