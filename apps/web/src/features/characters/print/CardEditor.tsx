import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowUp, Pencil, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { moveCard } from './cardEdits';
import type { CardChoice, CardGroup } from './usePrintData';

/**
 * The cards before printing, group by group in the order they print: each can be left out,
 * moved up or down within its group, and its text rewritten (or put back as the data has it).
 */
export function CardEditor({
  groups,
  hidden,
  order,
  edits,
  onHidden,
  onOrder,
  onEdits,
}: {
  groups: readonly CardGroup[];
  hidden: readonly string[];
  order: readonly string[];
  edits: Readonly<Record<string, string>>;
  onHidden: (next: string[]) => void;
  onOrder: (next: string[]) => void;
  onEdits: (next: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section aria-label="Cards" className="space-y-4 border-b border-border bg-surface px-4 py-3">
      <p className="text-sm text-muted">
        Leave cards out, change their order or rewrite their text: the pages below follow.
      </p>
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">{g.title}</h3>
          <ol
            aria-label={g.title}
            className="divide-y divide-border rounded-md border border-border"
          >
            {g.cards.map((c, i) => (
              <li key={c.id} aria-label={c.label} className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Print ${c.label}`}
                      checked={!hidden.includes(c.id)}
                      onChange={() => {
                        onHidden(
                          hidden.includes(c.id)
                            ? hidden.filter((h) => h !== c.id)
                            : [...hidden, c.id],
                        );
                      }}
                    />
                    <span
                      className={cn('truncate', hidden.includes(c.id) && 'text-faint line-through')}
                    >
                      {c.label}
                    </span>
                    {c.edited !== undefined && (
                      <span className="rounded bg-sunken px-1.5 text-xs text-muted">edited</span>
                    )}
                  </label>
                  <IconAction
                    label={`Move ${c.label} up`}
                    disabled={i === 0}
                    onClick={() => {
                      onOrder(moveCard(order, ids(g), c.id, -1));
                    }}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </IconAction>
                  <IconAction
                    label={`Move ${c.label} down`}
                    disabled={i === g.cards.length - 1}
                    onClick={() => {
                      onOrder(moveCard(order, ids(g), c.id, 1));
                    }}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </IconAction>
                  <IconAction
                    label={`Edit ${c.label}`}
                    onClick={() => {
                      setEditing(editing === c.id ? null : c.id);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </IconAction>
                </div>
                {editing === c.id && (
                  <TextEdit
                    card={c}
                    onSave={(text) => {
                      onEdits({ ...edits, [c.id]: text });
                      setEditing(null);
                    }}
                    onReset={() => {
                      const { [c.id]: _gone, ...rest } = edits;
                      onEdits(rest);
                      setEditing(null);
                    }}
                    onCancel={() => {
                      setEditing(null);
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

const ids = (g: CardGroup) => g.cards.map((c) => c.id);

function IconAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
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

function TextEdit({
  card,
  onSave,
  onReset,
  onCancel,
}: {
  card: CardChoice;
  onSave: (text: string) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(card.edited ?? card.source);
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(text);
      }}
    >
      <textarea
        aria-label={`Text of ${card.label}`}
        value={text}
        rows={Math.min(16, Math.max(5, text.split('\n').length + 2))}
        onChange={(e) => {
          setText(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      <p className="text-xs text-muted">
        A blank line starts a new paragraph; dice like 2d6 become chips.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          Save
        </Button>
        {card.edited !== undefined && (
          <Button type="button" variant="ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Back to the original
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
