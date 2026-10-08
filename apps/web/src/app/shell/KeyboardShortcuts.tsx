import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navModules } from '../nav';
import { useAppNavigate } from '../navigation';
import { useSearchPalette } from '../search/store';
import { useTabs } from '../tabs/store';
import { DICE_TRAY_EVENT, isTyping, SHORTCUT_GROUPS, shortcutFor } from './shortcuts';

/** Listens for the app-wide shortcuts and shows their list on "?". */
export function KeyboardShortcuts() {
  const navigate = useAppNavigate();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutFor({
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        typing: isTyping(e.target),
      });
      if (!action) return;
      e.preventDefault();
      const tabs = useTabs.getState();
      const at = tabs.tabs.findIndex((t) => t.id === tabs.activeId);
      switch (action.kind) {
        case 'search':
          useSearchPalette.getState().setOpen(true);
          return;
        case 'help':
          setHelp(true);
          return;
        case 'module': {
          const module = navModules.filter((m) => !m.footer)[action.index];
          if (module) navigate(module.path);
          return;
        }
        case 'newTab':
          navigate(tabs.openTab('/'));
          return;
        case 'closeTab':
          if (tabs.activeId) navigate(tabs.closeTab(tabs.activeId));
          return;
        case 'nextTab':
        case 'previousTab': {
          const n = tabs.tabs.length;
          const next = tabs.tabs[(at + (action.kind === 'nextTab' ? 1 : n - 1)) % n];
          if (next && n > 1) navigate(tabs.activateTab(next.id));
          return;
        }
        case 'dice':
          window.dispatchEvent(new Event(DICE_TRAY_EVENT));
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [navigate]);

  return (
    <Dialog.Root open={help} onOpenChange={setHelp}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(94vw,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center">
            <Dialog.Title className="flex-1 font-serif text-xl font-bold">
              Keyboard shortcuts
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded p-1 text-muted hover:bg-sunken">
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-muted">
            On a Mac, ⌘ works where Ctrl is shown.
          </Dialog.Description>
          <div className="grid gap-5 sm:grid-cols-2">
            {SHORTCUT_GROUPS.map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="mb-2 font-serif text-sm font-bold">{g.title}</h3>
                <dl className="space-y-1 text-sm">
                  {g.items.map((item) => (
                    <div key={item.label + item.keys.join()} className="flex items-baseline gap-2">
                      <dt className="flex shrink-0 gap-1">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="rounded border border-border-strong bg-sunken px-1.5 font-sans text-xs font-semibold"
                          >
                            {k}
                          </kbd>
                        ))}
                      </dt>
                      <dd className="text-muted">{item.label}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
