import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, RotateCcw, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GAP, MARGIN, PAGE_W } from '../../../app/cards/packing';
import type { CardChoice, CardPlace } from './usePrintData';

/**
 * Arranging the printed cards on the preview itself: each card has buttons to move it up or down
 * among its group, leave it out, or rewrite its text. Left-out cards wait on a page of their
 * own after the last one, which is never printed. Nothing here shows in the printed copy.
 */
export interface CardArranging {
  onMove: (id: string, group: readonly string[], delta: -1 | 1) => void;
  onHide: (id: string) => void;
  onShow: (id: string) => void;
  onEdit: (id: string, text: string | null) => void;
}

/** A card with its buttons (shown on hover, always on touch screens). */
export function ArrangedCard({
  place,
  arranging,
  children,
}: {
  place: CardPlace;
  arranging: CardArranging;
  children: ReactNode;
}) {
  const { choice, group } = place;
  const at = group.indexOf(choice.id);
  const [editing, setEditing] = useState(false);
  return (
    <div className="group/card relative">
      {children}
      <div
        role="group"
        aria-label={`Arrange ${choice.label}`}
        className="absolute top-1.5 right-1.5 flex gap-0.5 rounded-md border border-border bg-surface p-0.5 opacity-0 shadow-card transition group-hover/card:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Control
          label={`Move ${choice.label} up`}
          disabled={at <= 0}
          onClick={() => {
            arranging.onMove(choice.id, group, -1);
          }}
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        </Control>
        <Control
          label={`Move ${choice.label} down`}
          disabled={at < 0 || at >= group.length - 1}
          onClick={() => {
            arranging.onMove(choice.id, group, 1);
          }}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        </Control>
        <Control
          label={`Edit ${choice.label}`}
          onClick={() => {
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Control>
        <Control
          label={`Hide ${choice.label}`}
          onClick={() => {
            arranging.onHide(choice.id);
          }}
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        </Control>
      </div>
      {editing && (
        <CardTextDialog
          card={choice}
          onSave={(text) => {
            arranging.onEdit(choice.id, text);
            setEditing(false);
          }}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

/** The left-out cards, after the last page: shown on screen only, each with Show. */
export function HiddenCardsPage({
  cards,
  arranging,
}: {
  cards: readonly { choice: CardChoice; node: ReactNode }[];
  arranging: CardArranging;
}) {
  if (cards.length === 0) return null;
  return (
    <section
      aria-label="Hidden cards"
      className="mx-auto mb-6 box-border border-2 border-dashed border-border-strong bg-sunken"
      style={{ width: PAGE_W, padding: MARGIN }}
    >
      <h2 className="mb-1 text-center font-serif text-[13px] font-bold tracking-widest text-muted uppercase">
        Hidden cards
      </h2>
      <p className="mb-3 text-center text-xs text-muted">Not printed. Show one to put it back.</p>
      <div className="grid grid-cols-2" style={{ gap: GAP }}>
        {cards.map(({ choice, node }) => (
          <div key={choice.id} className="relative opacity-60 hover:opacity-100">
            {node}
            <Button
              variant="primary"
              className="absolute top-1.5 right-1.5"
              aria-label={`Show ${choice.label}`}
              onClick={() => {
                arranging.onShow(choice.id);
              }}
            >
              <Eye className="h-4 w-4" aria-hidden /> Show
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Control({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-muted hover:bg-sunken hover:text-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Rewriting a card's text (plain paragraphs), or putting back the data's own. */
function CardTextDialog({
  card,
  onSave,
  onClose,
}: {
  card: CardChoice;
  /** The new text, or null for the data's own again. */
  onSave: (text: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(card.edited ?? card.source);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Text of ${card.label}`}
        className="flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-lg bg-surface p-4 shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <div className="flex items-center gap-2">
          <h2 className="flex-1 font-serif text-lg font-bold">{card.label}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 hover:bg-sunken"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <textarea
          aria-label={`Text of ${card.label}`}
          value={text}
          rows={14}
          onChange={(e) => {
            setText(e.target.value);
          }}
          className={cn(
            'min-h-0 w-full flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm',
          )}
        />
        <p className="text-xs text-muted">
          A blank line starts a new paragraph; dice like 2d6 become chips.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">
            Save
          </Button>
          {card.edited !== undefined && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onSave(null);
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Back to the original
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
