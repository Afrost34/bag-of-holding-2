import { isAttachment, parseCompendiumRef, parseLinkInner } from '@boh/journal';
import { useContext, useMemo, type ReactNode } from 'react';
import type { BoardCard } from '../../app/boards/model';
import { resolveCompendiumRef } from '../../app/journal/compendium';
import { JournalViewContext, type JournalView } from '../../app/journal/notes/context';
import { EntityLinkClickContext } from '../../app/renderer/linkClick';
import { useBoardActions } from './context';

/**
 * Links inside a card bring what they lead to onto the board, beside the card: a compendium
 * entry or a journal note. Ctrl/Cmd/middle-click still opens the page in a tab.
 */
export function CardLinks({ card, children }: { card: BoardCard; children: ReactNode }) {
  const actions = useBoardActions();
  const parent = useContext(JournalViewContext);
  const view = useMemo<JournalView | null>(
    () =>
      parent && {
        ...parent,
        openLink: (inner, newTab) => {
          if (newTab) {
            parent.openLink(inner, newTab);
            return;
          }
          const link = parseLinkInner(inner);
          const ref = parseCompendiumRef(link.target);
          if (ref) {
            void resolveCompendiumRef(ref, parent.edition).then((key) => {
              if (key) actions.addBeside(card.id, [{ kind: 'entity', key }]);
            });
            return;
          }
          if (isAttachment(link.target)) return;
          const path = parent.resolve(link.target, parent.notePath ?? '');
          if (path) actions.addBeside(card.id, [{ kind: 'note', path }]);
        },
      },
    [parent, actions, card.id],
  );
  const body = (
    <EntityLinkClickContext.Provider
      value={(key) => {
        actions.addBeside(card.id, [{ kind: 'entity', key }]);
      }}
    >
      {children}
    </EntityLinkClickContext.Provider>
  );
  return view ? (
    <JournalViewContext.Provider value={view}>{body}</JournalViewContext.Provider>
  ) : (
    body
  );
}
