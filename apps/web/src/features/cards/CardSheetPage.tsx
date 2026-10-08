import { Button, cn } from '@boh/ui';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  EyeOff,
  Printer,
  SeparatorHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppLink } from '../../app/AppLink';
import { addCards, moveCard, updateCard, type CardSheet } from '../../app/cards/model';
import { useCardSheet, useCardSheets } from '../../app/cards/store';
import { useEntities } from '../../app/cards/useEntities';
import { typeLabel } from '../../app/format';
import { useAppNavigate } from '../../app/navigation';
import { EntitySearch } from '../../app/search/EntitySearch';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { CardPagesView } from './CardPages';
import { useCardPacking } from './packing';

/** Width of an A4 page in CSS pixels: the preview is scaled to fit the space it has. */
const PAGE_PX = (210 * 96) / 25.4;

/**
 * A card sheet: the cards in reading order on the left (hide, move, start a new page, remove,
 * add more), the A4 pages they pack into on the right, and printing.
 */
export function CardSheetPage({ id }: { id: string }) {
  const { loaded, load, save, remove } = useCardSheets();
  const sheet = useCardSheet(id);
  const navigate = useAppNavigate();
  usePageTitle(sheet?.name ?? 'Cards');
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const { entities, loaded: entitiesLoaded } = useEntities(sheet?.cards.map((c) => c.key) ?? []);
  const { packing, measurer, items } = useCardPacking(sheet?.cards ?? [], entities);
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? PAGE_PX;
      setScale(Math.min(1, width / (PAGE_PX + 16)));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [sheet?.id]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!sheet)
    return (
      <div className="p-8">
        <p className="mb-3">This card sheet does not exist.</p>
        <AppLink to="/cards" className="text-link hover:underline">
          Back to card sheets
        </AppLink>
      </div>
    );

  const set = (next: CardSheet) => {
    save(next);
  };
  const pageOf = new Map<string, number>();
  packing.pages.forEach((p, i) => {
    for (const cid of [...p.columns.flat(), ...(p.wide ? [p.wide] : [])]) pageOf.set(cid, i + 1);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <AppLink
          to="/cards"
          aria-label="Card sheets"
          className="rounded p-1 text-muted hover:bg-sunken"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </AppLink>
        <label htmlFor="sheet-name" className="sr-only">
          Sheet name
        </label>
        <input
          id="sheet-name"
          value={sheet.name}
          onChange={(e) => {
            set({ ...sheet, name: e.target.value });
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-serif text-xl font-bold hover:border-border focus:border-accent focus:outline-none"
        />
        <span className="text-sm text-muted">
          {sheet.cards.length} cards · {packing.pages.length} page
          {packing.pages.length === 1 ? '' : 's'}
        </span>
        <Button
          variant="primary"
          disabled={packing.pages.length === 0}
          onClick={() => {
            window.print();
          }}
        >
          <Printer className="h-4 w-4" aria-hidden /> Print / Save as PDF
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
        <aside
          aria-label="Cards"
          className="overflow-y-auto border-b border-border p-4 lg:border-r lg:border-b-0"
        >
          <EntitySearch
            onAdd={(key) => {
              set(addCards(sheet, [key]));
            }}
          />
          {sheet.cards.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No cards yet. Add some here, or use “Send to → Cards” on any compendium page.
            </p>
          ) : (
            <ol className="mt-3 space-y-1.5" aria-label="Cards in order">
              {sheet.cards.map((c, i) => {
                const e = entities.get(c.key);
                const name = e?.name ?? c.key;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      'rounded-md border border-border bg-surface px-2 py-1.5 text-sm',
                      c.hidden && 'opacity-50',
                      c.breakBefore && 'border-t-4 border-t-accent',
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted">
                          {e ? typeLabel(e.type) : entitiesLoaded ? 'Not in your data' : ''}
                          {!c.hidden && pageOf.has(c.id) && ` · page ${String(pageOf.get(c.id))}`}
                          {packing.tooTall.has(c.id) && (
                            <span className="text-accent-ink">
                              {' '}
                              <AlertTriangle className="inline h-3 w-3" aria-hidden /> too tall for
                              a page
                            </span>
                          )}
                        </span>
                      </span>
                      <IconAction
                        label={`Move ${name} up`}
                        disabled={i === 0}
                        onClick={() => {
                          set(moveCard(sheet, c.id, -1));
                        }}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </IconAction>
                      <IconAction
                        label={`Move ${name} down`}
                        disabled={i === sheet.cards.length - 1}
                        onClick={() => {
                          set(moveCard(sheet, c.id, 1));
                        }}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </IconAction>
                      <IconAction
                        label={
                          c.breakBefore ? `${name} continues the page` : `${name} starts a new page`
                        }
                        pressed={c.breakBefore === true}
                        onClick={() => {
                          set(updateCard(sheet, c.id, { breakBefore: !c.breakBefore }));
                        }}
                      >
                        <SeparatorHorizontal className="h-4 w-4" aria-hidden />
                      </IconAction>
                      <IconAction
                        label={c.hidden ? `Show ${name}` : `Hide ${name}`}
                        pressed={c.hidden === true}
                        onClick={() => {
                          set(updateCard(sheet, c.id, { hidden: !c.hidden }));
                        }}
                      >
                        {c.hidden ? (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden />
                        )}
                      </IconAction>
                      <IconAction
                        label={`Remove ${name}`}
                        onClick={() => {
                          set({ ...sheet, cards: sheet.cards.filter((x) => x.id !== c.id) });
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </IconAction>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete the card sheet “${sheet.name}”?`))
                void remove(sheet.id).then(() => {
                  navigate('/cards');
                });
            }}
            className="mt-6 inline-flex items-center gap-1 text-sm text-muted hover:text-accent-ink"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete this sheet
          </button>
        </aside>

        <div ref={previewRef} className="min-w-0 overflow-auto bg-sunken p-2 sm:p-4">
          {packing.pages.length > 0 && (
            <div style={{ zoom: scale }}>
              <CardPagesView packing={packing} items={items} />
            </div>
          )}
        </div>
      </div>

      {measurer}
      {packing.pages.length > 0 &&
        createPortal(
          <div className="print-root">
            <CardPagesView packing={packing} items={items} />
          </div>,
          document.body,
        )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      onClick={onClick}
      className={cn(
        'rounded p-1 text-muted hover:bg-sunken hover:text-text disabled:opacity-30',
        pressed && 'text-accent-ink',
      )}
    >
      {children}
    </button>
  );
}
