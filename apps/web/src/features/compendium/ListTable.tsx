import type { Category, FieldDef, ListRow } from '@boh/data5e';
import { cn } from '@boh/ui';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { AppLink } from '../../app/AppLink';
import { entityPath } from '../../app/data/entities';
import { wantsNewTab } from '../../app/navigation';
import { cellText, SOURCE_FIELD } from './listModel';

const ROW_HEIGHT = 40;

export interface ListTableProps {
  category: Category;
  rows: ListRow[];
  sort: string;
  dir: 'asc' | 'desc';
  selected: string | null;
  onSort: (field: string) => void;
  /** Called for a plain click; return true when handled (e.g. shown in the side pane). */
  onSelect: (row: ListRow) => boolean;
  /** Fewer columns, e.g. while the detail pane takes half the width. */
  compact?: boolean;
}

/** A virtualized, sortable table: only visible rows are rendered, so thousands stay smooth. */
export function ListTable({
  category,
  rows,
  sort,
  dir,
  selected,
  onSort,
  onSelect,
  compact = false,
}: ListTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = category.fields.filter((f) => f.column).slice(0, compact ? 2 : undefined);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is the intended API here
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const grid = `minmax(10rem, 1fr) ${columns.map((c) => `${String(c.width ?? 6)}rem`).join(' ')} 4.5rem`;

  const header = (
    id: string,
    label: string,
    align: 'left' | 'center' = 'left',
    hideOnMobile = false,
  ) => (
    <button
      type="button"
      onClick={() => {
        onSort(id);
      }}
      aria-sort={sort === id ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'flex items-center gap-1 truncate px-2 py-2 text-xs font-semibold text-muted uppercase hover:text-text',
        align === 'center' && 'justify-center',
        hideOnMobile && 'hidden sm:flex',
      )}
    >
      {label}
      {sort === id &&
        (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto"
      role="table"
      aria-label={`${category.label} list`}
      aria-rowcount={rows.length}
    >
      <div
        role="row"
        className="sticky top-0 z-10 grid border-b border-border bg-surface"
        style={{ gridTemplateColumns: grid }}
      >
        {header('name', 'Name')}
        {columns.map((c, i) => (
          <span key={c.id} role="columnheader" className={cn(i >= 2 && 'hidden sm:block')}>
            {header(c.id, c.label, isCentered(c) ? 'center' : 'left', i >= 2)}
          </span>
        ))}
        {header(SOURCE_FIELD, 'Source', 'left', true)}
      </div>
      <div style={{ height: `${String(virtualizer.getTotalSize())}px` }} className="relative">
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          return (
            <AppLink
              key={row.key}
              to={entityPath(row.key)}
              role="row"
              aria-selected={selected === row.key}
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                if (wantsNewTab(e) || e.shiftKey) return;
                if (onSelect(row)) e.preventDefault();
              }}
              className={cn(
                'absolute inset-x-0 grid items-center border-b border-border text-sm hover:bg-surface-2',
                selected === row.key && 'bg-accent-soft hover:bg-accent-soft',
              )}
              style={{
                top: 0,
                height: ROW_HEIGHT,
                transform: `translateY(${String(item.start)}px)`,
                gridTemplateColumns: grid,
              }}
            >
              <span role="cell" className="flex min-w-0 items-center gap-1.5 px-2">
                <span className="truncate font-medium">{row.name}</span>
                {row.type === 'magicvariant' && (
                  <span className="text-[10px] text-faint">generic</span>
                )}
              </span>
              {columns.map((c, i) => (
                <span
                  key={c.id}
                  role="cell"
                  className={cn(
                    'truncate px-2 text-muted',
                    isCentered(c) && 'text-center',
                    i >= 2 && 'hidden sm:block',
                  )}
                >
                  {cellText(row, c)}
                </span>
              ))}
              <span
                role="cell"
                className="hidden truncate px-2 text-xs text-faint sm:block"
                title={row.source}
              >
                {row.source}
                <span className="ml-1 font-semibold">{row.edition}</span>
              </span>
            </AppLink>
          );
        })}
      </div>
    </div>
  );
}

function isCentered(field: FieldDef): boolean {
  return field.kind === 'number' || field.kind === 'bool';
}
