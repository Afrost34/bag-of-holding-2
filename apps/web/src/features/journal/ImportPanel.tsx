import { convertNote, linkReport, planImport, prettyName } from '@boh/journal';
import { Button } from '@boh/ui';
import { CheckCircle2, FolderInput, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { forgetAttachment } from '../../app/journal/attachments';
import { useJournal } from '../../app/journal/store';

type Step =
  | { kind: 'pick' }
  | { kind: 'review'; files: Map<string, File>; skipped: number }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; written: number };

/**
 * One-time import of an Obsidian vault into this campaign's journal: pick the vault's folder,
 * check what comes in, import, then see which links lead nowhere.
 */
export function ImportPanel({
  onClose,
  onOpenNote,
}: {
  onClose: () => void;
  onOpenNote: (path: string) => void;
}) {
  const journal = useJournal();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (list: FileList | null) => {
    const all = [...(list ?? [])];
    if (all.length === 0) return;
    const plan = planImport(all.map((f) => f.webkitRelativePath || f.name));
    const byPath = new Map(
      all.map((f) => [
        (f.webkitRelativePath || f.name).replace(/\\/g, '/').split('/').slice(1).join('/'),
        f,
      ]),
    );
    const files = new Map(
      plan.files
        .map((p) => [p, byPath.get(p)])
        .filter((e): e is [string, File] => e[1] !== undefined),
    );
    setStep({ kind: 'review', files, skipped: plan.skipped.length });
  };

  const run = async (files: Map<string, File>) => {
    setError(null);
    setStep({ kind: 'importing', done: 0, total: files.size });
    try {
      const written = await journal.importFiles(
        [...files].map(([path, file]) => ({
          path,
          read: async () => {
            if (journal.campaignId) forgetAttachment(journal.campaignId, path);
            return path.toLowerCase().endsWith('.md')
              ? convertNote(await file.text())
              : new Uint8Array(await file.arrayBuffer());
          },
        })),
        replace,
        (done, total) => {
          setStep({ kind: 'importing', done, total });
        },
      );
      setStep({ kind: 'done', written });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep({ kind: 'review', files, skipped: 0 });
    }
  };

  return (
    <section
      aria-label="Import from Obsidian"
      className="mb-4 rounded-lg border border-border bg-surface p-4 text-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <FolderInput className="h-5 w-5 text-accent-ink" aria-hidden />
        <h2 className="flex-1 font-serif text-lg font-bold">Import from Obsidian</h2>
        <button
          type="button"
          aria-label="Close import"
          onClick={onClose}
          className="rounded p-1 text-muted hover:text-text"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error && (
        <p className="mb-2 rounded bg-sunken px-2 py-1 text-muted">Import stopped: {error}</p>
      )}

      {step.kind === 'pick' && (
        <>
          <p className="text-muted">
            Choose your vault&rsquo;s folder (the one that holds <code>.obsidian</code>). Notes,
            bases, images and PDFs come in with their folders, so every link keeps working.
            Obsidian&rsquo;s settings, its trash and other files are left out. Your vault is not
            changed.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-fg hover:bg-accent-hover">
            <FolderInput className="h-4 w-4" aria-hidden /> Choose vault folder
            <input
              type="file"
              multiple
              aria-label="Vault folder"
              className="sr-only"
              ref={(el) => {
                el?.setAttribute('webkitdirectory', '');
              }}
              onChange={(e) => {
                pick(e.target.files);
              }}
            />
          </label>
        </>
      )}

      {step.kind === 'review' && (
        <Review
          step={step}
          replace={replace}
          setReplace={setReplace}
          existing={journal}
          onImport={() => void run(step.files)}
          onBack={() => {
            setStep({ kind: 'pick' });
          }}
        />
      )}

      {step.kind === 'importing' && (
        <div>
          <p className="mb-2 text-muted">
            Importing… {step.done} of {step.total}
          </p>
          <progress
            className="w-full accent-[var(--boh-accent)]"
            value={step.done}
            max={step.total}
            aria-label="Import progress"
          />
        </div>
      )}

      {step.kind === 'done' && (
        <Done written={step.written} onOpenNote={onOpenNote} onClose={onClose} />
      )}
    </section>
  );
}

function Review({
  step,
  replace,
  setReplace,
  existing,
  onImport,
  onBack,
}: {
  step: Extract<Step, { kind: 'review' }>;
  replace: boolean;
  setReplace: (v: boolean) => void;
  existing: { notes: ReadonlyMap<string, string>; attachments: readonly string[] };
  onImport: () => void;
  onBack: () => void;
}) {
  const paths = [...step.files.keys()];
  const count = (re: RegExp) => paths.filter((p) => re.test(p)).length;
  const taken = new Set(
    [...existing.notes.keys(), ...existing.attachments].map((p) => p.toLowerCase()),
  );
  const clashes = paths.filter((p) => taken.has(p.toLowerCase())).length;
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Notes" value={count(/\.md$/i)} />
        <Stat label="Bases" value={count(/\.base$/i)} />
        <Stat label="Images" value={count(/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i)} />
        <Stat label="Other files" value={count(/\.(pdf|mp3|wav|ogg|mp4|webm)$/i)} />
      </ul>
      <p className="text-muted">
        {step.skipped > 0 &&
          `${String(step.skipped)} other files (scripts, shortcuts…) are left out, as are Obsidian’s settings and trash. `}
        {clashes > 0
          ? `${String(clashes)} already exist in this journal.`
          : 'Nothing in this journal has the same name.'}
      </p>
      {clashes > 0 && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => {
              setReplace(e.target.checked);
            }}
          />
          Replace those with the vault&rsquo;s version (otherwise they are kept)
        </label>
      )}
      <div className="flex gap-2">
        <Button variant="primary" onClick={onImport} disabled={paths.length === 0}>
          Import {paths.length} files
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Choose another folder
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-md bg-sunken px-3 py-2">
      <span className="block text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </li>
  );
}

function Done({
  written,
  onOpenNote,
  onClose,
}: {
  written: number;
  onOpenNote: (path: string) => void;
  onClose: () => void;
}) {
  const notes = useJournal((s) => s.notes);
  const attachments = useJournal((s) => s.attachments);
  const report = useMemo(() => linkReport(notes, attachments), [notes, attachments]);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? report.dead : report.dead.slice(0, 12);
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-5 w-5 text-accent-ink" aria-hidden />
        Imported {written} files.
      </p>
      <p className="text-muted">
        {report.resolved} of {report.total} links lead to a note or file
        {report.dead.length === 0
          ? '. All of them work.'
          : '. These lead nowhere (in Obsidian too): the note or file does not exist in the vault. Click a link in the note to create it.'}
      </p>
      {report.dead.length > 0 && (
        <ul
          aria-label="Links that lead nowhere"
          className="max-h-72 space-y-1 overflow-auto rounded-md border border-border p-2"
        >
          {shown.map((d) => (
            <li key={`${d.from}\n${d.target}`} className="flex flex-wrap items-baseline gap-x-2">
              <button
                type="button"
                onClick={() => {
                  onOpenNote(d.from);
                }}
                className="font-medium text-link hover:underline"
              >
                {prettyName(d.from)}
              </button>
              <span className="text-muted">→ {d.target}</span>
              {d.count > 1 && <span className="text-xs text-faint">×{d.count}</span>}
            </li>
          ))}
          {!showAll && report.dead.length > shown.length && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setShowAll(true);
                }}
                className="text-xs text-link hover:underline"
              >
                Show all {report.dead.length}
              </button>
            </li>
          )}
        </ul>
      )}
      <Button onClick={onClose}>Done</Button>
    </div>
  );
}
