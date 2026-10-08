import {
  isFile,
  isLink,
  noteName,
  prettyName,
  noteType,
  parseBase,
  propertiesForNew,
  runView,
  valueText,
  type BaseView as View,
  type NoteInfo,
  type Value,
} from '@boh/journal';
import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowUp, Code2, LayoutGrid, List, Plus, Search, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isImage } from '../attachments';
import { useJournalView } from './context';
import { useAttachmentUrl } from './useAttachmentUrl';

const VIEW_ICON = { table: Table2, cards: LayoutGrid, list: List } as const;

/**
 * A base (`.base` file or ```base block) as tables, cards or lists over the journal's notes.
 * `self` is the note a block sits in (`this` in its filters).
 */
export function BaseView({
  yaml,
  self,
  onEditSource,
  initialView,
}: {
  yaml: string;
  self?: NoteInfo | undefined;
  /** Shows the YAML to edit (a block's source, or the file's text). */
  onEditSource?: () => void;
  /** A view to start on, by name (`![[NPCs.base#High Danger]]`). */
  initialView?: string | undefined;
}) {
  const journal = useJournalView();
  const base = useMemo(() => parseBase(yaml), [yaml]);
  const [viewIndex, setViewIndex] = useState(() =>
    Math.max(0, initialView ? base.views.findIndex((v) => v.name === initialView) : 0),
  );
  const [sort, setSort] = useState<{ property: string; direction: 'ASC' | 'DESC' } | undefined>();
  const [search, setSearch] = useState('');
  const view: View | undefined = base.views[viewIndex] ?? base.views[0];

  const result = useMemo(
    () =>
      view
        ? runView(base, view, journal.noteInfos, {
            self,
            resolve: journal.resolve,
            sort,
            search,
          })
        : null,
    [base, view, journal.noteInfos, journal.resolve, self, sort, search],
  );

  if (base.error) {
    return (
      <div className="rounded-md border border-border p-3 text-sm">
        <p className="text-muted">This base could not be read: {base.error}</p>
        {onEditSource && (
          <Button size="sm" className="mt-2" onClick={onEditSource}>
            Edit
          </Button>
        )}
      </div>
    );
  }
  if (!view || !result) return null;

  // A new note made here gets the properties that make it show up here.
  const create = () => {
    const props = propertiesForNew(base, view, self ? noteName(self.path) : undefined);
    const { type, ...rest } = props;
    journal.startNote({ type: noteType(type), properties: rest });
  };

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.property === key
        ? s.direction === 'ASC'
          ? { property: key, direction: 'DESC' }
          : undefined
        : { property: key, direction: 'ASC' },
    );
  };

  return (
    <section
      aria-label={`Base: ${view.name}`}
      className="not-prose my-2 overflow-hidden rounded-lg border border-border bg-surface text-sm"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <div role="tablist" aria-label="Views" className="flex min-w-0 flex-wrap gap-0.5">
          {base.views.map((v, i) => {
            const Icon = VIEW_ICON[v.type];
            return (
              <button
                key={`${v.name}:${String(i)}`}
                type="button"
                role="tab"
                aria-selected={i === viewIndex}
                onClick={() => {
                  setViewIndex(i);
                  setSort(undefined);
                }}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                  i === viewIndex ? 'bg-sunken text-text' : 'text-muted hover:text-text',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {v.name}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <label className="flex items-center gap-1 rounded-md border border-border px-1.5">
          <Search className="h-3.5 w-3.5 text-faint" aria-hidden />
          <input
            aria-label="Search this base"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search"
            className="w-24 bg-transparent py-0.5 text-xs focus:outline-none sm:w-32"
          />
        </label>
        <span className="px-1 text-xs text-faint">{result.total}</span>
        {onEditSource && (
          <button
            type="button"
            aria-label="Edit base as text"
            title="Edit as text"
            onClick={onEditSource}
            className="rounded p-1 text-faint hover:bg-sunken hover:text-text"
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-label="New note in this base"
          title="New note"
          onClick={create}
          className="rounded p-1 text-faint hover:bg-sunken hover:text-text"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {result.error && (
        <p className="px-3 py-2 text-muted">A filter has a problem: {result.error}</p>
      )}
      {!result.error && result.total === 0 && (
        <p className="px-3 py-3 text-muted">{search ? 'Nothing matches.' : 'Nothing here yet.'}</p>
      )}

      {result.total > 0 &&
        (view.type === 'table' ? (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-[1] bg-bg">
                <tr>
                  {result.columns.map((c) => {
                    const active = sort?.property === c.key;
                    return (
                      <th
                        key={c.key}
                        aria-sort={
                          active ? (sort.direction === 'ASC' ? 'ascending' : 'descending') : 'none'
                        }
                        className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            toggleSort(c.key);
                          }}
                          className="flex items-center gap-1 hover:text-accent-ink"
                        >
                          {c.name}
                          {active &&
                            (sort.direction === 'ASC' ? (
                              <ArrowUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden />
                            ))}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {result.groups.map((g) => (
                <tbody key={g.label}>
                  {view.groupBy && (
                    <tr>
                      <th
                        colSpan={result.columns.length}
                        className="bg-sunken px-4 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase"
                      >
                        {g.label || 'None'} <span className="text-faint">{g.rows.length}</span>
                      </th>
                    </tr>
                  )}
                  {g.rows.map((r) => (
                    <tr
                      key={r.path}
                      className="border-b border-border last:border-0 odd:bg-surface-2 hover:bg-sunken"
                    >
                      {r.values.map((v, i) => (
                        <td
                          key={result.columns[i]?.key ?? i}
                          className={cn('px-4 py-2.5 align-top', i === 0 && 'font-semibold')}
                        >
                          <Cell
                            value={v}
                            path={r.path}
                            isName={result.columns[i]?.key === 'file.name'}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        ) : view.type === 'cards' ? (
          <div className="grid max-h-[40rem] grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 overflow-auto p-3">
            {result.groups.flatMap((g) =>
              g.rows.map((r) => (
                <Card
                  key={r.path}
                  path={r.path}
                  values={r.values}
                  columns={result.columns}
                  imageKey={view.image}
                />
              )),
            )}
          </div>
        ) : (
          <ul className="max-h-[32rem] overflow-auto py-1">
            {result.groups.flatMap((g) =>
              g.rows.map((r) => (
                <li key={r.path} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1">
                  <NoteLink path={r.path} />
                  <span className="text-xs text-muted">
                    {r.values
                      .filter((_, i) => result.columns[i]?.key !== 'file.name')
                      .map(valueText)
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              )),
            )}
          </ul>
        ))}
    </section>
  );
}

function NoteLink({ path }: { path: string }) {
  const { openPath } = useJournalView();
  return (
    <button
      type="button"
      onClick={(e) => {
        openPath(path, e.ctrlKey || e.metaKey);
      }}
      className="text-left font-medium text-link hover:underline"
    >
      {prettyName(path)}
    </button>
  );
}

function Cell({ value, path, isName }: { value: Value; path: string; isName: boolean }) {
  const { openLink } = useJournalView();
  if (isName) return <NoteLink path={path} />;
  if (value === null || value === '') return null;
  if (typeof value === 'boolean')
    return <span aria-label={value ? 'Yes' : 'No'}>{value ? '✓' : '–'}</span>;
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded-full bg-sunken px-2 text-xs">
            <Cell value={v} path={path} isName={false} />
          </span>
        ))}
      </span>
    );
  }
  if (isLink(value)) {
    return (
      <button
        type="button"
        onClick={(e) => {
          openLink(value.link, e.ctrlKey || e.metaKey);
        }}
        className="text-left text-link hover:underline"
      >
        {value.display ?? value.link}
      </button>
    );
  }
  if (isFile(value)) return <NoteLink path={value.file.path} />;
  return <span>{valueText(value)}</span>;
}

function Card({
  path,
  values,
  columns,
  imageKey,
}: {
  path: string;
  values: Value[];
  columns: { key: string; name: string }[];
  imageKey: string | undefined;
}) {
  const journal = useJournalView();
  const info = journal.noteInfos.find((n) => n.path === path);
  const raw =
    info?.properties[imageKey ?? ''] ??
    info?.properties.image ??
    info?.properties.banner ??
    info?.properties.cover;
  const target =
    typeof raw === 'string'
      ? raw
          .replace(/^!?\[\[|\]\]$/g, '')
          .split('|')[0]
          ?.trim()
      : undefined;
  const file = target && !/^https?:/i.test(target) ? journal.resolve(target, path) : null;
  const url = useAttachmentUrl(file && isImage(file) ? file : null);
  const src = target && /^https?:/i.test(target) ? target : url;
  return (
    <article className="overflow-hidden rounded-md border border-border bg-surface">
      {src ? (
        <img src={src} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="h-2 bg-accent/40" aria-hidden />
      )}
      <div className="space-y-1 p-2">
        <NoteLink path={path} />
        {values.map((v, i) => {
          const key = columns[i]?.key;
          if (key === 'file.name' || v === null || v === '') return null;
          return (
            <p key={key ?? i} className="text-xs">
              <span className="text-faint">{columns[i]?.name}: </span>
              <Cell value={v} path={path} isName={false} />
            </p>
          );
        })}
      </div>
    </article>
  );
}
