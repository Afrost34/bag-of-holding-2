/**
 * App-wide keyboard shortcuts: which key does what, and the list the help dialog shows. Pages add
 * their own (the map editor's tools); those are listed here too so one dialog shows them all.
 */

/** Event the dice tray listens for (Alt+D). */
export const DICE_TRAY_EVENT = 'boh:toggle-dice-tray';

export type ShortcutAction =
  | { kind: 'search' }
  | { kind: 'help' }
  | { kind: 'module'; index: number }
  | { kind: 'newTab' }
  | { kind: 'closeTab' }
  | { kind: 'nextTab' }
  | { kind: 'previousTab' }
  | { kind: 'dice' };

export interface KeyInput {
  key: string;
  /** The physical key (`KeyT`, `Digit1`): Alt on a Mac types other letters. */
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** The key went to a text field (typing there is not a shortcut). */
  typing: boolean;
}

/** What a key press asks for, or null. Alt+1…9 and Alt+0 open the first ten modules. */
export function shortcutFor(e: KeyInput): ShortcutAction | null {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey && !mod) {
    const code = e.code ?? '';
    const k = code.startsWith('Key')
      ? code.slice(3).toLowerCase()
      : code.startsWith('Digit')
        ? code.slice(5)
        : e.key.toLowerCase();
    if (/^[0-9]$/.test(k)) return { kind: 'module', index: k === '0' ? 9 : Number(k) - 1 };
    switch (k) {
      case 't':
        return { kind: 'newTab' };
      case 'w':
        return { kind: 'closeTab' };
      case 'd':
        return { kind: 'dice' };
      case 'pagedown':
        return { kind: 'nextTab' };
      case 'pageup':
        return { kind: 'previousTab' };
    }
    return null;
  }
  if (mod || e.typing) return null;
  if (e.key === '?') return { kind: 'help' };
  if (e.key === '/') return { kind: 'search' };
  return null;
}

/** Whether a key event's target is somewhere text is typed. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
    target.isContentEditable ||
    target.closest('.cm-editor') !== null
  );
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Everywhere',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Search everything' },
      { keys: ['/'], label: 'Search everything' },
      { keys: ['?'], label: 'These shortcuts' },
      { keys: ['Alt', '1 … 9, 0'], label: 'Open a module (in the order of the sidebar)' },
      { keys: ['Alt', 'D'], label: 'Dice tray' },
      { keys: ['Esc'], label: 'Close a dialog or panel' },
    ],
  },
  {
    title: 'Tabs',
    items: [
      { keys: ['Alt', 'T'], label: 'New tab' },
      { keys: ['Alt', 'W'], label: 'Close the tab' },
      { keys: ['Alt', 'Page Down'], label: 'Next tab' },
      { keys: ['Alt', 'Page Up'], label: 'Previous tab' },
      { keys: ['Ctrl', 'click'], label: 'Open a link in a new tab' },
    ],
  },
  {
    title: 'Maps',
    items: [
      { keys: ['V'], label: 'Select and move' },
      { keys: ['H'], label: 'Pan (or hold Space)' },
      { keys: ['S'], label: 'Stamp' },
      { keys: ['B'], label: 'Brush' },
      { keys: ['G'], label: 'Terrain brush' },
      { keys: ['W'], label: 'Wall (Enter or double-click to finish)' },
      { keys: ['T'], label: 'Text' },
      { keys: ['M'], label: 'Measure' },
      { keys: ['A'], label: 'Spell template' },
      { keys: ['P'], label: 'Pin' },
      { keys: ['R'], label: 'Turn the picked stamp (Shift+R back)' },
      { keys: ['[', ']'], label: 'Shrink or grow the picked stamp' },
      { keys: ['Delete'], label: 'Remove the picked item' },
      { keys: ['Ctrl', 'Z'], label: 'Undo (Ctrl+Shift+Z or Ctrl+Y redoes)' },
    ],
  },
];
