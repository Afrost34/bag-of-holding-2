import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { journalExtensions, type JournalEditorOptions } from './editor/setup';

/**
 * CodeMirror for one note. The view is created once per note; text changed elsewhere (links
 * rewritten by a rename) is applied without disturbing the cursor more than needed.
 */
export function NoteEditor({
  path,
  text,
  options,
}: {
  path: string;
  text: string;
  options: JournalEditorOptions;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Callbacks change every render; the editor always calls the latest ones.
  const latest = useRef(options);
  const latestText = useRef(text);
  useLayoutEffect(() => {
    latest.current = options;
    latestText.current = text;
  });

  useEffect(() => {
    if (!host.current) return;
    const proxy: JournalEditorOptions = {
      isResolved: (t) => latest.current.isResolved(t),
      notePaths: () => latest.current.notePaths(),
      searchCompendium: (q, type) => latest.current.searchCompendium(q, type),
      refFor: (e) => latest.current.refFor(e),
      typeLabel: (t) => latest.current.typeLabel(t),
      openLink: (inner, newTab) => {
        latest.current.openLink(inner, newTab);
      },
      openUrl: (url) => {
        latest.current.openUrl(url);
      },
      onChange: (t) => {
        latest.current.onChange(t);
      },
    };
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latestText.current,
        extensions: journalExtensions(proxy),
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // One view per note; later text changes are applied by the effect below.
  }, [path]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== text) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: text } });
    }
  }, [text]);

  return <div ref={host} className="min-h-[60vh]" aria-label="Note text" />;
}
