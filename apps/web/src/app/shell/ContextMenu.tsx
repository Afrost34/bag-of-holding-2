import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useAppNavigate } from '../navigation';
import { useSearchPalette } from '../search/store';
import {
  linkTarget,
  menuItems,
  type MenuItem,
  type MenuItemId,
  type MenuTarget,
} from './contextMenuModel';

interface Open {
  x: number;
  y: number;
  items: MenuItem[];
  target: MenuTarget;
  /** The text field right-clicked, for cut, paste and select all. */
  field: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
}

const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLElement =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'range', 'button', 'submit', 'color', 'file'].includes(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
const isPlain = (f: Field): f is HTMLInputElement | HTMLTextAreaElement =>
  f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement;

/** The text selected in a field. */
function selectedIn(field: Field): string {
  if (isPlain(field)) return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  return window.getSelection()?.toString() ?? '';
}

/**
 * Puts text in place of a field's selection. Plain fields get an input event so React sees the
 * change; editors (the note editor) get a paste event, which they handle like a real paste.
 */
function insertInto(field: Field, text: string): void {
  field.focus();
  if (isPlain(field)) {
    field.setRangeText(text, field.selectionStart ?? 0, field.selectionEnd ?? 0, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const data = new DataTransfer();
  data.setData('text/plain', text);
  field.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

/** Copies a field's selection and takes it out. */
function cutFrom(field: Field): void {
  const text = selectedIn(field);
  void navigator.clipboard.writeText(text);
  if (isPlain(field)) insertInto(field, '');
  else {
    field.focus();
    const data = new DataTransfer();
    field.dispatchEvent(
      new ClipboardEvent('cut', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }
}

/**
 * The app's own right-click menu, everywhere: the browser's (or Windows') menu never shows.
 * Parts with menus of their own (boards, maps) handle the event first and this stays closed.
 */
export function ContextMenu() {
  const [open, setOpen] = useState<Open | null>(null);
  const navigate = useAppNavigate();
  const router = useRouter();
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      const el = e.target instanceof Element ? e.target : null;
      const anchor = el?.closest('a[href]');
      const fieldEl = el?.closest('input, textarea, [contenteditable="true"]') ?? null;
      const field = isField(fieldEl) ? fieldEl : null;
      const link = anchor ? linkTarget(anchor.getAttribute('href') ?? '') : undefined;
      const selection = window.getSelection()?.toString() ?? '';
      const target: MenuTarget = {
        ...(link ? { link } : {}),
        ...(field ? { editable: true } : {}),
        ...(selection ? { selection } : {}),
      };
      setOpen({ x: e.clientX, y: e.clientY, items: menuItems(target), target, field });
    };
    document.addEventListener('contextmenu', onContext);
    return () => {
      document.removeEventListener('contextmenu', onContext);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('button')?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof PointerEvent && menu.current?.contains(e.target as Node)) return;
      setOpen(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (!open) return null;

  const run = (id: MenuItemId) => {
    const { target, field } = open;
    setOpen(null);
    const link = target.link;
    switch (id) {
      case 'open':
        // Outside links open in the browser (the desktop app sends window.open there).
        if (link?.outside) window.open(link.path, '_blank', 'noopener,noreferrer');
        else if (link) navigate(link.path);
        return;
      case 'open-tab':
        if (link) navigate(link.path, { newTab: true });
        return;
      case 'copy-link':
        if (link)
          void navigator.clipboard.writeText(
            link.outside ? link.path : `${location.origin}${location.pathname}#${link.path}`,
          );
        return;
      case 'copy':
        void navigator.clipboard.writeText(field ? selectedIn(field) : (target.selection ?? ''));
        return;
      case 'cut':
        if (field) cutFrom(field);
        return;
      case 'paste':
        if (field)
          void navigator.clipboard.readText().then((text) => {
            insertInto(field, text);
          });
        return;
      case 'select-all':
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
          field.select();
        else if (field) window.getSelection()?.selectAllChildren(field);
        field?.focus();
        return;
      case 'back':
        router.history.back();
        return;
      case 'forward':
        router.history.forward();
        return;
      case 'search':
        useSearchPalette.getState().setOpen(true);
        return;
    }
  };

  // Kept on screen near the pointer.
  const left = Math.min(open.x, window.innerWidth - 220);
  const top = Math.min(open.y, window.innerHeight - open.items.length * 36 - 16);
  return (
    <div
      ref={menu}
      role="menu"
      aria-label="Actions"
      style={{ left, top }}
      className="fixed z-[100] min-w-48 rounded-md border border-border bg-surface p-1 text-sm text-text shadow-card"
      onKeyDown={(e) => {
        const buttons = [...(menu.current?.querySelectorAll('button') ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') buttons[(at + 1) % buttons.length]?.focus();
        if (e.key === 'ArrowUp') buttons[(at - 1 + buttons.length) % buttons.length]?.focus();
      }}
    >
      {open.items.map((item) => (
        <div key={item.id}>
          {item.separator && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => {
              // Keeps the text field's selection for cut and copy.
              e.preventDefault();
            }}
            onClick={() => {
              run(item.id);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-left outline-none hover:bg-sunken focus:bg-sunken"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
