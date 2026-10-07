import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useRouterState } from '@tanstack/react-router';
import {
  ChevronDown,
  LayoutDashboard,
  Map as MapIcon,
  Send,
  SquareStack,
  StickyNote,
  Star,
  Swords,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { AppLink } from '../AppLink';
import { useActiveCampaign } from '../campaigns/store';
import { useCardSheets } from '../cards/store';
import { useAnnotations } from './store';

/** Where "Send to" will deliver an entry, and the milestone that builds each target. */
const SEND_TARGETS: { label: string; icon: LucideIcon; milestone: number }[] = [
  { label: 'Board', icon: LayoutDashboard, milestone: 9 },
  { label: 'Encounter', icon: Swords, milestone: 10 },
  { label: 'Map', icon: MapIcon, milestone: 11 },
];

function ToolButton({
  pressed,
  onClick,
  icon,
  children,
  ...rest
}: {
  pressed?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
} & Record<`aria-${string}`, string | boolean | undefined>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      {...rest}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors',
        pressed
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Bookmark, note and "Send to" for a compendium page, with the page's note below. `noteId` is a
 * reference (entity key or chapter id), never 5etools text.
 */
export function PageTools({ noteId, label }: { noteId: string; label: string }) {
  const path = useRouterState({ select: (s) => s.location.href });
  const { loaded, load, bookmarks, notes } = useAnnotations();
  const toggleBookmark = useAnnotations((s) => s.toggleBookmark);
  const setNote = useAnnotations((s) => s.setNote);
  const note = notes[noteId]?.text ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const noteFieldId = useId();
  const bookmarked = bookmarks.some((b) => b.path === path);
  // Entity pages can be sent as cards; book chapters cannot.
  const isKey = /^[a-z]+:.+@[^@]+$/.test(noteId);
  const [sent, setSent] = useState<{ sheet: string; name: string } | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditing = () => {
    setDraft(note);
    setEditing(true);
  };
  const finishEditing = () => {
    setNote(noteId, draft);
    setEditing(false);
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToolButton
          pressed={bookmarked}
          onClick={() => {
            toggleBookmark(path, label);
          }}
          icon={<Star className={cn('h-4 w-4', bookmarked && 'fill-current')} aria-hidden />}
        >
          {bookmarked ? 'Bookmarked' : 'Bookmark'}
        </ToolButton>
        <ToolButton
          pressed={editing || note !== ''}
          onClick={editing ? finishEditing : startEditing}
          icon={<StickyNote className="h-4 w-4" aria-hidden />}
          aria-expanded={editing}
          aria-controls={noteFieldId}
        >
          {note ? 'Edit note' : 'Add note'}
        </ToolButton>
        <Menu.Root>
          <Menu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-muted hover:border-border-strong hover:text-text"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send to
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="start"
              sideOffset={4}
              className="z-50 min-w-52 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
            >
              <SendToCards entityKey={isKey ? noteId : null} label={label} onSent={setSent} />
              {SEND_TARGETS.map(({ label: target, icon: Icon, milestone }) => (
                <Menu.Item
                  key={target}
                  disabled
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-muted outline-none data-[disabled]:cursor-default"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="flex-1">{target}</span>
                  <span className="rounded bg-sunken px-1.5 text-[10px] font-semibold">
                    M{milestone}
                  </span>
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>

      {sent && (
        <p role="status" className="mt-2 text-sm text-muted">
          Added to{' '}
          <AppLink to={`/cards/${sent.sheet}`} className="text-link hover:underline">
            {sent.name}
          </AppLink>
          .
        </p>
      )}

      {editing ? (
        <div className="mt-3">
          <label htmlFor={noteFieldId} className="sr-only">
            Your note on {label}
          </label>
          <textarea
            id={noteFieldId}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setNote(noteId, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') finishEditing();
            }}
            rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
            placeholder="Your notes on this page: rulings, reminders, where you used it… Saved as you type."
            className="w-full rounded-md border border-accent bg-surface p-3 text-[15px] leading-relaxed"
          />
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={finishEditing}
              className="text-xs font-semibold tracking-wide text-accent uppercase hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        loaded &&
        note !== '' && (
          <button
            type="button"
            onClick={startEditing}
            aria-label="Your note (click to edit)"
            className="mt-3 block w-full rounded-md border-l-4 border-accent bg-accent-soft px-4 py-3 text-left text-[15px] leading-relaxed whitespace-pre-wrap hover:brightness-110"
          >
            {note}
          </button>
        )
      )}
    </div>
  );
}

/** "Send to → Cards": a sheet of the open campaign (or outside campaigns), or a new one. */
function SendToCards({
  entityKey,
  label,
  onSent,
}: {
  entityKey: string | null;
  label: string;
  onSent: (sent: { sheet: string; name: string }) => void;
}) {
  const { sheets, loaded, load, send, create } = useCardSheets();
  const campaign = useActiveCampaign();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  const mine = sheets.filter((s) => (s.campaign ?? null) === (campaign?.id ?? null));
  const itemClass =
    'flex items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken';
  if (!entityKey)
    return (
      <Menu.Item disabled className={cn(itemClass, 'text-muted')}>
        <SquareStack className="h-4 w-4" aria-hidden /> Cards
      </Menu.Item>
    );
  return (
    <Menu.Group aria-label="Cards">
      <Menu.Label className="flex items-center gap-2 px-2 pt-1.5 pb-0.5 text-xs font-semibold text-muted uppercase">
        <SquareStack className="h-3.5 w-3.5" aria-hidden /> Cards
      </Menu.Label>
      {mine.map((sheet) => (
        <Menu.Item
          key={sheet.id}
          className={cn(itemClass, 'pl-7')}
          onSelect={() => {
            send(sheet.id, [entityKey]);
            onSent({ sheet: sheet.id, name: sheet.name });
          }}
        >
          {sheet.name}
        </Menu.Item>
      ))}
      <Menu.Item
        className={cn(itemClass, 'pl-7')}
        onSelect={() => {
          const name = campaign ? `${campaign.name} cards` : 'Cards';
          void create(name, campaign?.id, [entityKey]).then((sheet) => {
            onSent({ sheet: sheet.id, name: sheet.name });
          });
        }}
      >
        New card sheet with {label}
      </Menu.Item>
      <Menu.Separator className="my-1 h-px bg-border" />
    </Menu.Group>
  );
}
