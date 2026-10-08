import type { Category, FieldDef, ListRow } from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { cn } from '@boh/ui';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown, Minus, Plus } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath, useEntity } from '../../app/data/entities';
import { useAppNavigate, wantsNewTab } from '../../app/navigation';
import { LegacyBadge } from '../../app/lists/LegacyBadge';
import { Cell, SchoolIcon } from '../../app/lists/cells';
import { rarityClass } from '../../app/lists/rarity';
import { SpellDetails } from '../../app/lists/SpellDetails';

export interface ListRowsProps {
  category: Category;
  rows: ListRow[];
  sort: string;
  dir: 'asc' | 'desc';
  onSort: (field: string) => void;
  /** Key of the row shown expanded, if any. */
  expanded: string | null;
  onExpand: (key: string | null) => void;
  /** The page's scroll container: the list scrolls with the page. */
  scrollElement: HTMLElement | null;
  sourceName: (id: string) => string;
}

const GAP = 8;

/**
 * Compendium list as separate row cards that expand in place to show the full entry. Only the
 * rows on screen are rendered, so thousands of entries stay smooth.
 */
export function ListRows({
  category,
  rows,
  sort,
  dir,
  onSort,
  expanded,
  onExpand,
  scrollElement,
  sourceName,
}: ListRowsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const navigate = useAppNavigate();
  const columns = category.fields.filter((f) => f.column);
  const leading = category.id === 'spells';

  // The list starts below the heading and filters; keep the virtualizer's offset in sync.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scrollElement) return;
    const update = () => {
      setScrollMargin(
        list.getBoundingClientRect().top -
          scrollElement.getBoundingClientRect().top +
          scrollElement.scrollTop,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (scrollElement.firstElementChild) observer.observe(scrollElement.firstElementChild);
    return () => {
      observer.disconnect();
    };
  }, [scrollElement]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is the intended API here
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 64 + GAP,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  // Name gets the most room; columns share the rest by their width hints. Phones show the name
  // and the first column only.
  const template: CSSProperties = {
    ['--cols-sm' as string]: `${leading ? '2.25rem ' : ''}minmax(0,1fr) ${columns[0] ? 'minmax(0,5.5rem) ' : ''}1.5rem`,
    ['--cols-lg' as string]: `${leading ? '2.25rem ' : ''}minmax(10rem,${String(maxWidth(columns) * 1.6)}fr) ${columns
      .map((c) => `minmax(0,${String(c.width ?? 6)}fr)`)
      .join(' ')} 1.5rem`,
  };
  const gridClass = 'grid grid-cols-(--cols-sm) items-center gap-x-4 md:grid-cols-(--cols-lg)';

  const header = (id: string, label: string, className?: string) => (
    <button
      type="button"
      onClick={() => {
        onSort(id);
      }}
      // (aria-sort belongs to table headers; this list is a grid of rows, so the name says it.)
      aria-label={`Sort by ${label}${sort === id ? (dir === 'asc' ? ', ascending' : ', descending') : ''}`}
      className={cn(
        'flex min-w-0 items-center gap-1 text-left text-[11px] font-semibold tracking-wider uppercase hover:text-accent-ink',
        sort === id ? 'text-text' : 'text-muted',
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {sort === id ? (
        dir === 'asc' ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-faint" aria-hidden />
      )}
    </button>
  );

  return (
    <div style={template}>
      <div className={cn(gridClass, 'sticky top-0 z-10 border-b border-border bg-bg px-4 py-2.5')}>
        {leading && <span />}
        {header('name', 'Name')}
        {columns.map((c, i) => (
          <span key={c.id} className={cn('min-w-0', i > 0 && 'hidden md:block')}>
            {header(c.id, c.label)}
          </span>
        ))}
        <span />
      </div>

      <div
        ref={listRef}
        role="list"
        aria-label={`${category.label} list`}
        className="relative mt-2"
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const open = expanded === row.key;
          const panelId = `row-${String(item.index)}`;
          return (
            <div
              key={item.key}
              role="listitem"
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{
                transform: `translateY(${String(item.start - virtualizer.options.scrollMargin)}px)`,
                paddingBottom: GAP,
              }}
            >
              <div
                className={cn(
                  'overflow-hidden rounded-lg border bg-surface transition-colors',
                  open ? 'border-accent' : 'border-border hover:border-border-strong',
                )}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? panelId : undefined}
                  onClick={(e: MouseEvent) => {
                    if (wantsNewTab(e)) navigate(entityPath(row.key), { newTab: true });
                    else onExpand(open ? null : row.key);
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) navigate(entityPath(row.key), { newTab: true });
                  }}
                  className={cn(gridClass, 'min-h-16 w-full px-4 py-2.5 text-left text-sm')}
                >
                  {leading && <SchoolIcon school={String(row.f.school)} />}
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-[15px] font-semibold',
                          category.id === 'magic-items' && rarityClass(row.f.rarity),
                        )}
                      >
                        {row.name}
                      </span>
                      {row.legacy && (
                        <span className="hidden sm:inline">
                          <LegacyBadge />
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                      {/* Phones: the badge moves under the name so the name keeps its room. */}
                      {row.legacy && (
                        <span className="sm:hidden">
                          <LegacyBadge />
                        </span>
                      )}
                      <span className="truncate">{row.sub ?? sourceName(row.source)}</span>
                    </span>
                  </span>
                  {columns.map((c, i) => (
                    <span key={c.id} className={cn('min-w-0 truncate', i > 0 && 'hidden md:block')}>
                      <Cell row={row} field={c} />
                    </span>
                  ))}
                  <span className="flex justify-end text-accent-ink">
                    {open ? (
                      <Minus className="h-5 w-5" aria-hidden />
                    ) : (
                      <Plus className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                </button>
                {open && (
                  <div id={panelId} className="border-t border-border px-4 py-4">
                    <RowDetails row={row} sourceName={sourceName(row.source)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function maxWidth(columns: readonly FieldDef[]): number {
  return Math.max(8, ...columns.map((c) => c.width ?? 6));
}

/** The full entry inside an expanded row, with a link to its page. */
function RowDetails({ row, sourceName }: { row: ListRow; sourceName: string }) {
  const state = useEntity(row.key);
  const classes = Array.isArray(row.f.classes) ? row.f.classes : [];
  return (
    <>
      {state.status === 'found' ? (
        <div className="text-[15px] leading-relaxed">
          {state.entity.type === 'spell' ? (
            <SpellDetails row={row} entity={state.entity} />
          ) : (
            <EntityView
              type={state.entity.type}
              data={state.entity.data}
              edition={state.entity.edition}
            />
          )}
        </div>
      ) : (
        <p className="text-muted">{state.status === 'loading' ? 'Loading…' : 'Not found.'}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
        <AppLink
          to={entityPath(row.key)}
          className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-fg uppercase hover:bg-accent-hover"
        >
          View details page
        </AppLink>
        {classes.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">Available for:</span>
            {classes.map((c) => (
              <span
                key={c}
                className="rounded border border-border px-1.5 py-0.5 font-semibold uppercase"
              >
                {c}
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto text-sm text-muted italic">
          {sourceName}
          {row.page !== null && `, p. ${String(row.page)}`}
        </span>
      </div>
    </>
  );
}
