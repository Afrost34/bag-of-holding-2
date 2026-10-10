import { isAttachment, linkTargetFor } from '@boh/journal';
import { dataWorker } from '../../app/data/client';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { typeLabel } from '../../app/format';
import { forgetAttachment } from '../../app/journal/attachments';
import { noteRefFor } from '../../app/journal/compendium';
import { useJournalView } from '../../app/journal/notes/context';
import type { JournalEditorOptions } from '../../app/journal/notes/editor/setup';
import { NoteEditor } from '../../app/journal/notes/NoteEditor';
import { useJournal } from '../../app/journal/store';

/**
 * The journal's own editor inside a board card: for taking notes during the session. Saves as you
 * type (the journal writes the file shortly after), with links, compendium links, tables and
 * pasted pictures as in the journal.
 */
export function BoardNoteEditor({ path, text }: { path: string; text: string }) {
  const view = useJournalView();
  const journal = useJournal();
  const sources = useSourceList((s) => s.sources);
  const overrides = useSourcePrefs((s) => s.overrides);
  const paths = [...journal.notes.keys()].sort();
  const saveFiles = async (files: File[]) => {
    const targets: string[] = [];
    for (const file of files) {
      const saved = await journal.addAttachment(
        file.name,
        new Uint8Array(await file.arrayBuffer()),
      );
      forgetAttachment(view.campaignId, saved);
      targets.push(saved.slice(saved.lastIndexOf('/') + 1));
    }
    return targets;
  };
  const options: JournalEditorOptions = {
    isResolved: view.isResolved,
    notePaths: () => paths,
    searchCompendium: (query, type) =>
      dataWorker().search(query, {
        limit: 15,
        excludeSources: disabledSourceIds(sources, overrides),
        ...(type ? { types: [type] } : {}),
      }),
    refFor: noteRefFor,
    typeLabel,
    openLink: view.openLink,
    openUrl: view.openUrl,
    openTag: view.openTag,
    onChange: (t) => {
      journal.setText(path, t);
    },
    saveFiles,
    pickImages: () =>
      new Promise<string[]>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = () => {
          void saveFiles([...(input.files ?? [])]).then(resolve);
        };
        input.click();
      }),
    linkFor: (p) => linkTargetFor(p, isAttachment(p) ? journal.attachments : paths),
  };
  return (
    <NoteEditor
      key={path}
      path={path}
      text={text}
      options={options}
      onToggleCode={() => undefined}
    />
  );
}
