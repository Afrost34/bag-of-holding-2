import { fieldLabel, noteType, type FieldDef } from '@boh/journal';
import { Button } from '@boh/ui';
import { Pencil } from 'lucide-react';
import { NoteTypeIcon } from './NoteTypeIcon';

const LINK = /^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/;
/** Shown elsewhere (banner, page title) or as chips (tags). */
const NOT_LISTED = new Set([
  'type',
  'tags',
  'tag',
  'title',
  'image',
  'banner',
  'cover',
  'cssclasses',
  'aliases',
]);

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * A note's properties laid out as an info card at the top of the note (like a wiki's infobox):
 * its kind, its details with links you can follow, and its tags. "Edit details" opens the wizard.
 */
export function NoteInfoCard({
  data,
  onEdit,
  openLink,
  openTag,
}: {
  data: Record<string, unknown>;
  onEdit: () => void;
  openLink: (target: string, newTab: boolean) => void;
  openTag: (tag: string) => void;
}) {
  const kind = noteType(data.type);
  const typed = kind?.fields.map((f) => f.key) ?? [];
  const rows: { key: string; value: unknown; field?: FieldDef | undefined }[] = [
    ...typed.map((key) => ({
      key,
      value: data[key],
      field: kind?.fields.find((f) => f.key === key),
    })),
    ...Object.entries(data)
      .filter(([k]) => !NOT_LISTED.has(k) && !typed.includes(k))
      .map(([key, value]) => ({ key, value })),
  ].filter((r) => !isEmpty(r.value));
  const rawTags = data.tags ?? data.tag;
  const tags = (
    Array.isArray(rawTags) ? rawTags : typeof rawTags === 'string' ? rawTags.split(/[,\s]+/) : []
  )
    .map((t) => String(t).replace(/^#/, ''))
    .filter(Boolean);

  if (!kind && rows.length === 0 && tags.length === 0) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-faint hover:bg-sunken hover:text-text"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Add details
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Details"
      className="mb-4 rounded-lg border border-border bg-surface text-sm"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        {kind && <NoteTypeIcon type={kind} className="h-4 w-4 text-accent" />}
        <span className="flex-1 text-xs font-semibold tracking-wide text-muted uppercase">
          {kind?.label ?? (typeof data.type === 'string' ? data.type : 'Details')}
        </span>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit details
        </Button>
      </header>
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[minmax(7rem,auto)_1fr_minmax(7rem,auto)_1fr]">
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-muted">{fieldLabel(r.key)}</dt>
              <dd className="min-w-0 break-words">
                <Value value={r.value} openLink={openLink} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-3 py-2.5 text-muted">
          Nothing filled in yet.{' '}
          <button type="button" onClick={onEdit} className="text-link hover:underline">
            Fill in the details
          </button>
        </p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-border px-3 py-2">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                openTag(t);
              }}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent hover:underline"
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Value({
  value,
  openLink,
}: {
  value: unknown;
  openLink: (target: string, newTab: boolean) => void;
}) {
  if (Array.isArray(value)) {
    const items = value as unknown[];
    return (
      <span className="flex flex-wrap gap-x-1.5">
        {items.map((v, i) => (
          <span key={i}>
            <Value value={v} openLink={openLink} />
            {i < items.length - 1 ? ',' : ''}
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string') {
    const m = LINK.exec(value.trim());
    if (m) {
      return (
        <button
          type="button"
          onClick={(e) => {
            openLink(m[1] ?? '', e.ctrlKey || e.metaKey);
          }}
          className="text-left font-medium text-link hover:underline"
        >
          {(m[2] ?? m[1] ?? '').replace(/_+/g, ' ')}
        </button>
      );
    }
    return <span className="whitespace-pre-line">{value}</span>;
  }
  if (typeof value === 'number') return <span>{value}</span>;
  return <span className="text-muted">{JSON.stringify(value)}</span>;
}
