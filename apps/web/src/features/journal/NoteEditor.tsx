import { parseFrontmatter } from '@boh/journal';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { journalExtensions, type JournalEditorOptions } from './editor/setup';
import { useEmbedHost } from './embedHost';
import { JournalEmbed } from './JournalEmbed';

/** The smallest change turning `a` into `b`: their common start and end are left alone. */
function diff(a: string, b: string): { from: number; to: number; insert: string } {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  return { from: start, to: a.length - end, insert: b.slice(start, b.length - end) };
}

/**
 * CodeMirror for one note. The view is created once per note (remount it with a `key` to change
 * `hideFrontmatter`); text changed elsewhere (the properties panel, links rewritten by a rename)
 * is applied as a small change, so the cursor stays where it was.
 */
export function NoteEditor({
  path,
  text,
  options,
}: {
  path: string;
  text: string;
  options: Omit<JournalEditorOptions, 'embeds'>;
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
  const embeds = useEmbedHost();
  const embedHost = embeds.host;

  useEffect(() => {
    if (!host.current) return;
    const o = latest.current;
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
      openTag: (tag) => latest.current.openTag?.(tag),
      onChange: (t) => {
        latest.current.onChange(t);
      },
      saveFiles: (files) => latest.current.saveFiles?.(files) ?? Promise.resolve([]),
      linkFor: (p) => latest.current.linkFor?.(p) ?? p,
      hideFrontmatter: o.hideFrontmatter === true,
      embeds: embedHost,
    };
    const doc = latestText.current;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc,
        // Start after hidden properties rather than inside them.
        selection: { anchor: o.hideFrontmatter ? parseFrontmatter(doc).bodyStart : 0 },
        extensions: journalExtensions(proxy),
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // One view per note; later text changes are applied by the effect below.
  }, [path, embedHost]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== text) v.dispatch({ changes: diff(current, text) });
  }, [text]);

  return (
    <>
      <div ref={host} className="min-h-[60vh]" aria-label="Note text" />
      {embeds.portals((inner) => (
        <JournalEmbed inner={inner} />
      ))}
    </>
  );
}
