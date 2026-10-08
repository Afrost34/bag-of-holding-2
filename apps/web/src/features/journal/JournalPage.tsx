import {
  applyTemplate,
  bannerOf,
  baseFor,
  baseListsType,
  buildIndex,
  isAttachment,
  linkTargetFor,
  newNoteText,
  noteName,
  prettyName,
  noteType,
  noteTags,
  parseCompendiumRef,
  parseFrontmatter,
  parseLinkInner,
  parseWikiLinks,
  resolveLinkPath,
  setProperty,
  templatePaths,
  type NoteInfo,
  type FieldDef,
  type NoteType,
  type PropertyValue,
} from '@boh/journal';
import { Button, cn } from '@boh/ui';
import { FilePlus, FolderTree, Link2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import { dataWorker } from '../../app/data/client';
import { entityPath } from '../../app/data/entities';
import { useSourceList } from '../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../app/data/sourcePrefs';
import { typeLabel } from '../../app/format';
import { noteRefFor, resolveCompendiumRef } from '../../app/journal/compendium';
import { journalPath, notePagePath } from '../../app/journal/paths';
import { useJournalPrefs } from '../../app/journal/prefs';
import { useJournal } from '../../app/journal/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { forgetAttachment } from '../../app/journal/attachments';
import { BaseView } from '../../app/journal/notes/BaseView';
import {
  JournalViewContext,
  useJournalView,
  type JournalView,
  type NewNoteSpec,
} from '../../app/journal/notes/context';
import type { JournalEditorOptions } from '../../app/journal/notes/editor/setup';
import { FileTree } from './FileTree';
import { NoteInfoCard } from './NoteInfoCard';
import { NoteWizard, type WizardResult } from './NoteWizard';
import { ImportPanel } from './ImportPanel';
import { NoteTypeIcon } from '../../app/journal/NoteTypeIcon';
import { useAllNoteTypes } from '../../app/journal/noteTypes';
import { NoteKindsDialog } from './NoteKindsDialog';
import { EmbedContent } from '../../app/journal/notes/JournalEmbed';
import { LinkPreviewContent, LinkPreviews } from './LinkPreview';
import { NoteEditor } from '../../app/journal/notes/NoteEditor';
import { PropertiesPanel } from './PropertiesPanel';
import { TagsPane } from './TagsPane';
import { buildTagTree, moveTarget } from './tree';
import { useAttachmentUrl } from '../../app/journal/notes/useAttachmentUrl';

const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
/** A note's or base's name without its extension. */
const displayName = prettyName;
const isBasePath = (path: string) => path.toLowerCase().endsWith('.base');
/** A folder's own name as words: `05_NPCs` → `NPCs`, for matching it to a kind of note. */
const folderWords = (path: string) => (path.split('/').pop() ?? '').replace(/[_\d-]+/g, ' ');

/** What the "new note" form is making. */
interface Creating {
  kind: 'template';
  path: string;
}

/** The wizard: a new note (of a kind, with some properties) or the open note's details. */
type Wizard =
  | { mode: 'create'; type: NoteType | undefined; properties: Record<string, PropertyValue> }
  | { mode: 'edit' };

/** The open campaign's notes: file tree, live-preview editor and backlinks. */
export function JournalPage({ note }: { note: string | undefined }) {
  const campaign = useActiveCampaign();
  const campaignsLoaded = useCampaigns((s) => s.loaded);
  const journal = useJournal();
  const navigate = useAppNavigate();
  const sources = useSourceList((s) => s.sources);
  const overrides = useSourcePrefs((s) => s.overrides);
  const [filesOpen, setFilesOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const editorBox = useRef<HTMLDivElement>(null);
  const [sidebar, setSidebar] = useState<'files' | 'tags'>('files');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // Per session: show the raw frontmatter in the editor instead of hiding it.
  const codeMode = useJournalPrefs((s) => s.codeMode);
  const setCodeMode = useJournalPrefs((s) => s.setCodeMode);
  const [wizard, setWizard] = useState<Wizard | null>(null);
  const allTypes = useAllNoteTypes();
  const [editingKinds, setEditingKinds] = useState(false);
  const [creating, setCreating] = useState<Creating | null>(null);
  const [importing, setImporting] = useState(false);

  usePageTitle(note ? displayName(note) : 'Journal');
  useEffect(() => {
    void useCampaigns.getState().load();
  }, []);
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);

  // The journal opens on the note last open in this campaign.
  const journalReady = journal.loaded && journal.campaignId === campaign?.id;
  useEffect(() => {
    if (!campaign || !journalReady) return;
    const prefs = useJournalPrefs.getState();
    if (note) {
      if (journal.notes.has(note)) prefs.setLastNote(campaign.id, note);
      return;
    }
    const last = prefs.lastNote[campaign.id];
    if (last && journal.notes.has(last)) navigate(journalPath(last), { replace: true });
  }, [campaign, journalReady, note, journal.notes, navigate]);

  const paths = useMemo(() => [...journal.notes.keys()].sort(), [journal.notes]);
  const index = useMemo(() => buildIndex(journal.notes), [journal.notes]);
  const text = note !== undefined ? journal.notes.get(note) : undefined;
  const tagTree = useMemo(
    () => buildTagTree(new Map([...journal.notes].map(([p, t]) => [p, noteTags(t)]))),
    [journal.notes],
  );
  const noteInfos = useMemo<NoteInfo[]>(
    () =>
      [...journal.notes].map(([path, t]) => ({
        path,
        properties: parseFrontmatter(t).data,
        tags: noteTags(t),
        links: parseWikiLinks(t).map((l) => l.target),
      })),
    [journal.notes],
  );
  const attachments = journal.attachments;
  const resolve = useMemo(
    () => (target: string, from: string) =>
      resolveLinkPath(target, isAttachment(target) ? attachments : paths, from),
    [attachments, paths],
  );

  if (!campaignsLoaded || (campaign && !journal.loaded)) {
    return <p className="p-8 text-muted">Loading…</p>;
  }
  if (!campaign) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Journal</h1>
        <p className="mt-2 text-muted">
          Each campaign has its own journal. Create a campaign first.
        </p>
        <AppLink
          to="/campaigns"
          className="mt-4 inline-block font-medium text-link hover:underline"
        >
          Campaigns
        </AppLink>
      </div>
    );
  }

  const open = (path: string, newTab = false) => {
    navigate(journalPath(path), { newTab });
    setFilesOpen(false);
  };

  const newNote = async (folder: string, name?: string) => {
    open(await journal.createNote(folder, name));
  };

  const newFolder = async (parent: string) => {
    let name = 'New folder';
    const taken = new Set(journal.folders.map((f) => f.toLowerCase()));
    const prefix = parent ? `${parent}/` : '';
    for (let n = 1; taken.has(`${prefix}${name}`.toLowerCase()); n++)
      name = `New folder ${String(n)}`;
    await journal.createFolder(`${prefix}${name}`);
  };

  const existing = [...paths, ...journal.attachments, ...journal.folders];

  /** Moves or renames a note, file or folder, following the open note if it moved. */
  const relocate = async (path: string, target: string) => {
    await journal.move(path, target);
    if (note && (note === path || note.startsWith(`${path}/`))) {
      navigate(journalPath(`${target}${note.slice(path.length)}`));
    }
  };

  const rename = async (path: string, newName: string) => {
    const isFolder = journal.folders.includes(path);
    // Notes keep `.md` and other files their own extension.
    const ext = isFolder ? '' : (/\.[^./]+$/.exec(path)?.[0] ?? '');
    const clean = newName.replace(/[\\/:*?"<>|]/g, '-');
    const stem =
      ext && clean.toLowerCase().endsWith(ext.toLowerCase()) ? clean.slice(0, -ext.length) : clean;
    const target = `${folderOf(path) ? `${folderOf(path)}/` : ''}${stem}${ext}`;
    const clash = existing.some((p) => p.toLowerCase() === target.toLowerCase());
    if (clash && target.toLowerCase() !== path.toLowerCase()) {
      setMessage(`There is already something called “${stem}” here.`);
      return;
    }
    await relocate(path, target);
  };

  const moveInto = async (path: string, folder: string) => {
    if (folder === folderOf(path)) return;
    const result = moveTarget(path, folder, existing, journal.folders.includes(path));
    if (result.ok) await relocate(path, result.to);
    else setMessage(result.reason);
  };

  const remove = async (path: string) => {
    await journal.remove(path);
    setConfirmDelete(null);
    if (note && (note === path || note.startsWith(`${path}/`))) navigate('/journal');
  };

  const openLink = async (inner: string, newTab: boolean) => {
    const link = parseLinkInner(inner);
    const ref = parseCompendiumRef(link.target);
    if (ref) {
      const key = await resolveCompendiumRef(ref, campaign.edition);
      if (key) navigate(entityPath(key), { newTab });
      else setMessage(`“${ref.name}” is not in your data (or its source is turned off).`);
      return;
    }
    if (isAttachment(link.target)) return;
    const path = resolveLinkPath(link.target, paths, note);
    // A note of a kind the compendium lists (an NPC, a location…) opens there, like an entry.
    const page = path ? notePagePath(path, journal.notes.get(path)) : null;
    if (path && page !== journalPath(path)) {
      navigate(page ?? '', { newTab });
      return;
    }
    // Like Obsidian: following a link to a note that does not exist yet creates it.
    open(
      path ?? (await journal.createNote('', link.target.split('/').pop() ?? link.target)),
      newTab,
    );
  };

  const openTag = (tag: string) => {
    setSidebar('tags');
    setSelectedTag(tag);
    if (window.matchMedia('(max-width: 767px)').matches) setFilesOpen(true);
  };

  const saveFiles = async (files: File[]) => {
    const targets: string[] = [];
    for (const file of files) {
      const path = await journal.addAttachment(file.name, new Uint8Array(await file.arrayBuffer()));
      forgetAttachment(campaign.id, path);
      targets.push(path.slice(path.lastIndexOf('/') + 1));
    }
    return targets;
  };

  const newFromTemplate = async (template: string, name: string) => {
    const body = applyTemplate(journal.notes.get(template) ?? '', {
      title: name,
      now: new Date(),
    });
    setCreating(null);
    open(await journal.createNote(note ? folderOf(note) : '', name, body));
  };

  /** The first base listing a kind of note is made with its first note, so it shows at once. */
  const ensureBase = async (type: NoteType) => {
    if ([...journal.bases.values()].some((t) => baseListsType(t, type))) return;
    const folder =
      journal.folders.find((f) => /\b(bases|databases)\b/i.test(folderWords(f))) ?? 'Bases';
    let path = `${folder}/${type.plural}.base`;
    for (let n = 1; journal.attachments.includes(path); n++) {
      path = `${folder}/${type.plural} ${String(n)}.base`;
    }
    await journal.saveBase(path, baseFor(type));
  };

  const createNote = async ({ name, type, properties }: NewNoteSpec) => {
    let body = type ? newNoteText(type, name) : '';
    for (const [key, value] of Object.entries(properties ?? {})) {
      body = setProperty(body, key, value);
    }
    // A kind of note goes in its folder: an existing one (`05_NPCs`) or a new one (`NPCs`).
    const folder = type
      ? (journal.folders.find((f) => type.folderMatch.test(folderWords(f))) ?? type.folder)
      : note && !isBasePath(note)
        ? folderOf(note)
        : '';
    const path = await journal.createNote(folder, name, body);
    if (type) await ensureBase(type);
    setCreating(null);
    open(path);
  };

  /** Asks for image files, saves them with the journal and returns their link targets. */
  const pickImages = (multiple = true) =>
    new Promise<string[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;
      input.onchange = () => {
        void saveFiles([...(input.files ?? [])]).then(resolve);
      };
      input.click();
    });

  const view: JournalView = {
    campaignId: campaign.id,
    edition: campaign.edition,
    notes: journal.notes,
    attachments,
    bases: journal.bases,
    noteInfos,
    notePath: note,
    resolve,
    isResolved: (target) => resolveLinkPath(target, paths, note) !== null,
    openLink: (inner, newTab) => void openLink(inner, newTab),
    openPath: (path, newTab) => {
      open(path, newTab);
    },
    openUrl: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openTag,
    createNote: (spec) => createNote(spec),
    startNote: ({ type, properties }) => {
      setWizard({ mode: 'create', type, properties: properties ?? {} });
    },
    Embed: EmbedContent,
  };

  const editorOptions: JournalEditorOptions = {
    isResolved: (target) => resolveLinkPath(target, paths, note) !== null,
    notePaths: () => paths,
    searchCompendium: (query, type) =>
      dataWorker().search(query, {
        limit: 15,
        excludeSources: disabledSourceIds(sources, overrides),
        ...(type ? { types: [type] } : {}),
      }),
    refFor: noteRefFor,
    typeLabel,
    openLink: (inner, newTab) => void openLink(inner, newTab),
    openUrl: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openTag,
    onChange: (t) => {
      if (note) journal.setText(note, t);
    },
    saveFiles,
    pickImages,
    linkFor: (p) => linkTargetFor(p, isAttachment(p) ? journal.attachments : paths),
    codeMode,
    onEditSource: () => {
      setCodeMode(true);
    },
  };

  const templates = templatePaths(paths);

  // The open note's kind (NPC, location…) shapes its properties panel.
  const data = text !== undefined ? parseFrontmatter(text).data : {};
  const kind = noteType(data.type);
  const fieldFor = (key: string) => kind?.fields.find((f) => f.key === key);
  const linkTo = (path: string) => `[[${linkTargetFor(path, paths)}]]`;
  const suggest = (key: string, field: FieldDef | undefined = fieldFor(key)): string[] => {
    if (field?.kind === 'link' || field?.kind === 'links') {
      return noteInfos
        .filter(
          (n) =>
            n.path !== note &&
            (!field.linkType || String(n.properties.type).toLowerCase() === field.linkType),
        )
        .map((n) => linkTo(n.path))
        .sort((a, b) => a.localeCompare(b));
    }
    const values = new Set<string>(field?.options ?? []);
    for (const n of noteInfos) {
      const raw = key === 'tags' ? n.tags : n.properties[key];
      for (const v of Array.isArray(raw) ? raw : [raw]) {
        if (typeof v === 'string' && v.trim() && values.size < 60) values.add(v.trim());
      }
    }
    return [...values];
  };
  const asLink = (value: string) => {
    if (/^\[\[[^\]]+\]\]$/.test(value)) return value;
    const path = resolveLinkPath(value, paths, note);
    return path ? linkTo(path) : null;
  };
  const missingFields = kind ? kind.fields.filter((f) => !(f.key in data)) : [];

  // The name the wizard shows and edits: the `title` property, else the file's name.
  const shownName =
    note && typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : note
        ? prettyName(note)
        : '';

  const saveWizard = async (result: WizardResult) => {
    const w = wizard;
    setWizard(null);
    if (!w) return;
    // A picture chosen in the wizard is saved with the journal only now.
    if (result.imageFile) {
      const [target] = await saveFiles([result.imageFile]);
      if (target) result.values.image = `[[${target}]]`;
    }
    if (w.mode === 'create') {
      await createNote({ name: result.name, type: result.type, properties: result.values });
      return;
    }
    if (!note || text === undefined) return;
    let next = text;
    // Made into a kind of note (or another kind): its type, tag and usual fields.
    if (result.type && kind?.id !== result.type.id) {
      next = setProperty(next, 'type', result.type.id);
      const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
      if (!tags.includes(result.type.id))
        next = setProperty(next, 'tags', [...tags, result.type.id]);
      for (const f of result.type.fields) {
        if (!(f.key in data) && !(f.key in result.values))
          next = setProperty(next, f.key, f.initial ?? null);
      }
    }
    for (const [key, value] of Object.entries(result.values)) {
      if (value === null && !(key in data)) continue;
      if (JSON.stringify(data[key] ?? null) === JSON.stringify(value)) continue;
      next = setProperty(next, key, value);
    }
    if (typeof data.title === 'string' && data.title !== result.name) {
      next = setProperty(next, 'title', result.name);
    }
    if (next !== text) journal.setText(note, next);
    if (result.name !== shownName && result.name !== noteName(note))
      await rename(note, result.name);
  };

  const wizardHelpers = {
    suggest,
    asLink,
    resolveImage: (target: string) => resolveLinkPath(target, journal.attachments, note),
  };

  const fileTree = (
    <FileTree
      templates={templates}
      noteTypes={allTypes}
      onEditKinds={() => {
        setEditingKinds(true);
        setFilesOpen(false);
      }}
      onNewFromTemplate={(p) => {
        setCreating({ kind: 'template', path: p });
        setFilesOpen(false);
      }}
      onNewOfType={(type) => {
        setWizard({ mode: 'create', type, properties: {} });
        setFilesOpen(false);
      }}
      onImport={() => {
        setImporting(true);
        setFilesOpen(false);
      }}
      notes={paths}
      attachments={journal.attachments}
      folders={journal.folders}
      current={note ?? null}
      onOpen={(p) => {
        open(p);
      }}
      onNewNote={(folder) => void newNote(folder)}
      onNewFolder={(parent) => void newFolder(parent)}
      onRename={(p, n) => void rename(p, n)}
      onDelete={(p) => {
        setConfirmDelete(p);
      }}
      onMove={(p, folder) => void moveInto(p, folder)}
    />
  );

  const tree = (
    <>
      <div role="tablist" aria-label="Sidebar" className="mb-2 flex gap-1 px-2">
        {(['files', 'tags'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={sidebar === tab}
            onClick={() => {
              setSidebar(tab);
            }}
            className={cn(
              'flex-1 rounded-md py-1 text-xs font-semibold tracking-wide uppercase',
              sidebar === tab ? 'bg-sunken text-text' : 'text-muted hover:text-text',
            )}
          >
            {tab === 'files' ? 'Files' : 'Tags'}
          </button>
        ))}
      </div>
      {sidebar === 'files' ? (
        fileTree
      ) : (
        <TagsPane
          tags={tagTree}
          selected={selectedTag}
          onOpenNote={(p) => {
            open(p);
          }}
        />
      )}
    </>
  );

  const backlinks = note ? (index.backlinks.get(note) ?? []) : [];

  return (
    <JournalViewContext.Provider value={view}>
      <NoteKindsDialog
        open={editingKinds}
        onClose={() => {
          setEditingKinds(false);
        }}
      />
      <div className="flex h-full">
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface py-3 md:flex">
          {tree}
        </aside>
        {filesOpen && (
          <div className="fixed inset-0 z-30 overflow-y-auto bg-surface py-3 md:hidden">
            <div className="flex justify-end px-2">
              <button
                type="button"
                aria-label="Close files"
                onClick={() => {
                  setFilesOpen(false);
                }}
                className="rounded p-1 text-muted hover:text-text"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {tree}
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto after:block after:h-16 after:content-['']">
          <div className="mx-auto max-w-3xl px-4 py-5 md:px-8">
            <div className="mb-3 flex items-center gap-2 md:hidden">
              <Button
                size="sm"
                onClick={() => {
                  setFilesOpen(true);
                }}
              >
                <FolderTree className="h-4 w-4" aria-hidden /> Files
              </Button>
            </div>

            {message && (
              <div
                role="status"
                className="mb-3 flex items-center gap-2 rounded-md bg-sunken px-3 py-2 text-sm"
              >
                <span className="flex-1">{message}</span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => {
                    setMessage(null);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}

            {confirmDelete && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-sm">
                <span className="flex-1">
                  Delete “{confirmDelete}”
                  {journal.folders.includes(confirmDelete) ? ' and everything in it' : ''}?
                </span>
                <Button variant="primary" size="sm" onClick={() => void remove(confirmDelete)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirmDelete(null);
                  }}
                >
                  Keep
                </Button>
              </div>
            )}

            {wizard && (
              <NoteWizard
                mode={wizard.mode}
                initialType={wizard.mode === 'create' ? wizard.type : kind}
                initialName={wizard.mode === 'create' ? '' : shownName}
                initialValues={
                  wizard.mode === 'create'
                    ? {
                        ...Object.fromEntries(
                          (wizard.type?.fields ?? []).map((f) => [f.key, f.initial ?? null]),
                        ),
                        ...wizard.properties,
                      }
                    : data
                }
                helpers={wizardHelpers}
                onCancel={() => {
                  setWizard(null);
                }}
                onSave={(r) => void saveWizard(r)}
              />
            )}

            {importing && (
              <ImportPanel
                onClose={() => {
                  setImporting(false);
                }}
                onOpenNote={(p) => {
                  open(p);
                }}
              />
            )}

            {creating && (
              <TemplateForm
                key={creating.path}
                label={`New note from the “${noteName(creating.path)}” template`}
                onCreate={(name) => {
                  void newFromTemplate(creating.path, name);
                }}
                onCancel={() => {
                  setCreating(null);
                }}
              />
            )}

            {note !== undefined && isBasePath(note) && journal.bases.has(note) ? (
              <article>
                <NoteTitle key={note} path={note} onRename={(name) => void rename(note, name)} />
                {folderOf(note) && <p className="mb-2 text-xs text-faint">{folderOf(note)}</p>}
                <BaseFilePage
                  key={note}
                  yaml={journal.bases.get(note) ?? ''}
                  onSave={(yaml) => journal.saveBase(note, yaml)}
                />
              </article>
            ) : note !== undefined && text !== undefined ? (
              <article>
                <Banner text={text} />
                <NoteTitle key={note} path={note} onRename={(name) => void rename(note, name)} />
                {folderOf(note) && <p className="mb-2 text-xs text-faint">{folderOf(note)}</p>}
                {codeMode ? (
                  <PropertiesPanel
                    text={text}
                    onChange={(t) => {
                      journal.setText(note, t);
                    }}
                    onError={setMessage}
                    openTag={openTag}
                    openLink={view.openLink}
                    showSource={codeMode}
                    onToggleSource={() => {
                      setCodeMode(!codeMode);
                    }}
                    fieldFor={fieldFor}
                    suggest={suggest}
                    asLink={asLink}
                    missingFields={missingFields}
                    typeLabel={kind?.label}
                  />
                ) : (
                  <NoteInfoCard
                    data={data}
                    onEdit={() => {
                      setWizard({ mode: 'edit' });
                    }}
                    openLink={view.openLink}
                    openTag={openTag}
                  />
                )}
                <div ref={editorBox}>
                  <NoteEditor
                    key={`${note}|${String(codeMode)}`}
                    path={note}
                    text={text}
                    options={editorOptions}
                    onToggleCode={() => {
                      setCodeMode(!codeMode);
                    }}
                  />
                </div>
                <LinkPreviews container={editorBox}>
                  {(inner) => <LinkPreviewContent inner={inner} />}
                </LinkPreviews>
              </article>
            ) : (
              <EmptyJournal
                noteTypes={allTypes}
                campaign={campaign.name}
                count={paths.length}
                missing={note !== undefined}
                onNew={() => void newNote('')}
                onNewOfType={(type) => {
                  setWizard({ mode: 'create', type, properties: {} });
                }}
                onImport={() => {
                  setImporting(true);
                }}
              />
            )}
          </div>
        </div>

        <aside
          aria-label="Journal side"
          className="hidden w-64 shrink-0 space-y-5 overflow-y-auto border-l border-border p-4 text-sm lg:block"
        >
          <section aria-label="Create">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
              <FilePlus className="h-3.5 w-3.5" aria-hidden /> Create
            </h2>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => void newNote('')}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-sunken"
              >
                <FilePlus className="h-4 w-4 text-muted" aria-hidden /> Note
              </button>
              {allTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`New ${t.label}`}
                  onClick={() => {
                    setWizard({ mode: 'create', type: t, properties: {} });
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-sunken"
                >
                  <NoteTypeIcon type={t} className="h-4 w-4 text-muted" /> {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEditingKinds(true);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-link hover:bg-sunken"
              >
                <Plus className="h-4 w-4" aria-hidden /> New kind of note…
              </button>
            </div>
          </section>
          {note !== undefined && text !== undefined && (
            <section aria-label="Backlinks">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                <Link2 className="h-3.5 w-3.5" aria-hidden /> Linked from
              </h2>
              {backlinks.length === 0 ? (
                <p className="text-muted">No notes link here yet.</p>
              ) : (
                <ul className="space-y-2">
                  {[...new Set(backlinks.map((b) => b.from))].map((from) => (
                    <li key={from}>
                      <button
                        type="button"
                        onClick={() => {
                          open(from);
                        }}
                        className="text-left font-medium text-link hover:underline"
                      >
                        {prettyName(from)}
                      </button>
                      <p className="line-clamp-2 text-xs text-muted">
                        {snippet(
                          journal.notes.get(from) ?? '',
                          backlinks.find((b) => b.from === from)?.link.start ?? 0,
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </JournalViewContext.Provider>
  );
}

/** A banner across the top of a note: its `banner`, `image` or `cover` property. */
function Banner({ text }: { text: string }) {
  const banner = bannerOf(parseFrontmatter(text).data);
  const { attachments, notePath } = useJournalView();
  const file =
    banner?.kind === 'file' ? resolveLinkPath(banner.target, attachments, notePath) : null;
  const fileUrl = useAttachmentUrl(file);
  const src = banner?.kind === 'url' ? banner.target : fileUrl;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="mb-4 h-40 w-full rounded-lg object-cover sm:h-52"
      draggable={false}
    />
  );
}

function TemplateForm({
  label,
  onCreate,
  onCancel,
}: {
  label: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const clean = name.replace(/[\\/:*?"<>|]/g, '-').trim();
  return (
    <form
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onCreate(clean);
      }}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm"
    >
      <span className="w-full font-medium">{label}</span>
      <input
        autoFocus
        aria-label="Name of the new note"
        placeholder="Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 focus:border-accent focus:outline-none"
      />
      <Button type="submit" variant="primary" size="sm" disabled={!clean}>
        Create
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

/** The text around a link, for the backlinks list. */
function snippet(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at) + 1;
  const end = text.indexOf('\n', at);
  return text
    .slice(start, end === -1 ? undefined : end)
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
}

function NoteTitle({ path, onRename }: { path: string; onRename: (name: string) => void }) {
  const [name, setName] = useState(displayName(path));
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== displayName(path)) onRename(trimmed);
    else setName(displayName(path));
  };
  return (
    <input
      aria-label="Note title"
      value={name}
      onChange={(e) => {
        setName(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="mb-1 w-full border-b-2 border-transparent bg-transparent pb-1 font-serif text-3xl font-bold outline-none focus:border-accent"
    />
  );
}

function EmptyJournal({
  campaign,
  count,
  missing,
  onNew,
  onNewOfType,
  onImport,
  noteTypes,
}: {
  noteTypes: readonly NoteType[];
  campaign: string;
  count: number;
  missing: boolean;
  onNew: () => void;
  onNewOfType: (type: NoteType) => void;
  onImport: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-2xl font-bold">
        {missing ? 'Note not found' : `${campaign} journal`}
      </h1>
      <p className="mt-2 text-muted">
        {missing
          ? 'It may have been renamed or deleted.'
          : count === 0
            ? 'Notes for this campaign: people, places, sessions, plans. Link them with [[ ]].'
            : 'Pick a note from the files, or start a new one.'}
      </p>
      <Button variant="primary" className={cn('mt-4')} onClick={onNew}>
        <FilePlus className="h-4 w-4" aria-hidden /> New note
      </Button>
      {!missing && (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Or start a…</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {noteTypes.map((t) => (
              <Button
                key={t.id}
                size="sm"
                onClick={() => {
                  onNewOfType(t);
                }}
              >
                <NoteTypeIcon type={t} /> {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {!missing && count === 0 && (
        <p className="mt-6 text-sm text-muted">
          Coming from Obsidian?{' '}
          <button
            type="button"
            onClick={onImport}
            className="font-medium text-link hover:underline"
          >
            Import your vault
          </button>
        </p>
      )}
    </div>
  );
}

/** A `.base` file: its views, and its YAML to edit. */
function BaseFilePage({ yaml, onSave }: { yaml: string; onSave: (yaml: string) => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (editing !== null) {
    return (
      <div className="space-y-2">
        <textarea
          aria-label="Base YAML"
          value={editing}
          spellCheck={false}
          onChange={(e) => {
            setEditing(e.target.value);
          }}
          rows={Math.min(30, Math.max(10, editing.split('\n').length + 1))}
          className="w-full rounded-md border border-border bg-surface p-3 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void onSave(editing).then(() => {
                setEditing(null);
              });
            }}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(null);
            }}
          >
            Cancel
          </Button>
        </div>
        <BaseView yaml={editing} />
      </div>
    );
  }
  return (
    <BaseView
      yaml={yaml}
      onEditSource={() => {
        setEditing(yaml);
      }}
    />
  );
}
