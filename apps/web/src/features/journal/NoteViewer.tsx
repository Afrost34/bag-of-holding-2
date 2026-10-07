import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useContext, useEffect, useRef } from 'react';
import { EmbedDepthContext, useJournalView } from './context';
import { journalViewerExtensions } from './editor/setup';
import { useEmbedHost } from './embedHost';

/**
 * A note (or part of one) shown read-only, formatted as in the editor: used for link previews and
 * embedded notes. Remount it (with a `key`) to show other text.
 */
export function NoteViewer({ text }: { text: string }) {
  const view = useJournalView();
  const depth = useContext(EmbedDepthContext);
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(view);
  useEffect(() => {
    latest.current = view;
  });
  const embeds = useEmbedHost();
  const embedHost = embeds.host;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text,
        extensions: journalViewerExtensions({
          isResolved: (t) => latest.current.isResolved(t),
          openLink: (inner, newTab) => {
            latest.current.openLink(inner, newTab);
          },
          openUrl: (url) => {
            latest.current.openUrl(url);
          },
          openTag: (tag) => {
            latest.current.openTag(tag);
          },
          embeds: embedHost,
        }),
      }),
    });
    return () => {
      v.destroy();
    };
    // Remounted (by key) when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <EmbedDepthContext.Provider value={depth + 1}>
      <div ref={host} />
      {embeds.portals((embed) => (
        <view.Embed embed={embed} />
      ))}
    </EmbedDepthContext.Provider>
  );
}
