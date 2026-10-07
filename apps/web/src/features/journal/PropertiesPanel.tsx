import {
  parseFrontmatter,
  propertyKind,
  removeProperty,
  renameProperty,
  setProperty,
  type PropertyValue,
} from '@boh/journal';
import { cn } from '@boh/ui';
import { ChevronRight, Code2, ExternalLink, Plus, X } from 'lucide-react';
import { useState } from 'react';

const LINK = /^\[\[([^\]]+)\]\]$/;

/**
 * A note's properties (YAML frontmatter) as an editable list, like Obsidian's properties view.
 * Every edit rewrites only the property it touches.
 */
export function PropertiesPanel({
  text,
  onChange,
  onError,
  openTag,
  openLink,
  showSource,
  onToggleSource,
}: {
  text: string;
  onChange: (text: string) => void;
  onError: (message: string) => void;
  openTag: (tag: string) => void;
  openLink: (inner: string, newTab: boolean) => void;
  showSource: boolean;
  onToggleSource: () => void;
}) {
  const fm = parseFrontmatter(text);
  const entries = Object.entries(fm.data);
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  const apply = (edit: (t: string) => string) => {
    try {
      onChange(edit(text));
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  const sourceToggle = (
    <button
      type="button"
      onClick={onToggleSource}
      aria-pressed={showSource}
      title={showSource ? 'Hide the properties text' : 'Edit the properties as text'}
      className={cn(
        'rounded p-1 text-faint hover:bg-sunken hover:text-text',
        showSource && 'text-accent',
      )}
    >
      <Code2 className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Properties as text</span>
    </button>
  );

  if (entries.length === 0 && !fm.error && !adding) {
    return (
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setAdding(true);
          }}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-faint hover:bg-sunken hover:text-text"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add property
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Properties" className="mb-3 border-b border-border pb-2 text-sm">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex flex-1 items-center gap-1 py-1 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
            aria-hidden
          />
          Properties
        </button>
        {sourceToggle}
      </div>
      {fm.error && (
        <p className="my-1 rounded bg-sunken px-2 py-1 text-xs text-muted">
          These properties are not valid YAML, so they are ignored. Fix them as text.
        </p>
      )}
      {open && (
        <div className="mt-1 space-y-0.5">
          {entries.map(([key, value]) => (
            <PropertyRow
              key={`${key}\u0000${JSON.stringify(value)}`}
              name={key}
              value={value}
              onRename={(to) => {
                if (to && to !== key) apply((t) => renameProperty(t, key, to));
              }}
              onSet={(v) => {
                apply((t) => setProperty(t, key, v));
              }}
              onRemove={() => {
                apply((t) => removeProperty(t, key));
              }}
              openTag={openTag}
              openLink={openLink}
            />
          ))}
          {adding ? (
            <NewProperty
              taken={entries.map(([k]) => k)}
              onAdd={(key) => {
                setAdding(false);
                if (key) apply((t) => setProperty(t, key, ''));
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
              className="flex items-center gap-1 rounded px-1 py-1 text-xs text-faint hover:bg-sunken hover:text-text"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add property
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const inputClass =
  'min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border focus:border-accent focus:outline-none';

function PropertyRow({
  name,
  value,
  onRename,
  onSet,
  onRemove,
  openTag,
  openLink,
}: {
  name: string;
  value: unknown;
  onRename: (to: string) => void;
  onSet: (value: PropertyValue) => void;
  onRemove: () => void;
  openTag: (tag: string) => void;
  openLink: (inner: string, newTab: boolean) => void;
}) {
  const [key, setKey] = useState(name);
  const kind = propertyKind(value);
  return (
    <div className="group flex items-start gap-2">
      <input
        aria-label={`Property name ${name}`}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
        }}
        onBlur={() => {
          onRename(key.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={cn(inputClass, 'w-28 flex-none text-muted sm:w-36')}
      />
      <div className="flex min-w-0 flex-1 items-center">
        {kind === 'boolean' ? (
          <input
            type="checkbox"
            aria-label={name}
            checked={value === true}
            onChange={(e) => {
              onSet(e.target.checked);
            }}
            className="m-1.5 h-4 w-4 accent-[var(--boh-accent)]"
          />
        ) : kind === 'list' ? (
          <ListValue
            name={name}
            items={(value as unknown[]).map((v) => String(v))}
            onSet={onSet}
            onOpen={(item) => {
              const link = LINK.exec(item)?.[1];
              if (link) openLink(link, false);
              else if (/^tags?$/i.test(name)) openTag(item.replace(/^#/, ''));
            }}
          />
        ) : typeof value === 'object' && value !== null ? (
          <span className="px-1.5 py-1 text-xs text-muted">Nested values: edit as text</span>
        ) : (
          <TextValue
            name={name}
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            number={kind === 'number'}
            onSet={onSet}
            openLink={openLink}
          />
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove property ${name}`}
        onClick={onRemove}
        className="mt-1 rounded p-0.5 text-faint opacity-0 group-hover:opacity-100 hover:text-text focus:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function TextValue({
  name,
  value,
  number,
  onSet,
  openLink,
}: {
  name: string;
  value: string;
  number: boolean;
  onSet: (value: PropertyValue) => void;
  openLink: (inner: string, newTab: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const link = LINK.exec(value)?.[1];
  const commit = () => {
    if (draft === value) return;
    const n = Number(draft);
    onSet(number && draft.trim() !== '' && Number.isFinite(n) ? n : draft);
  };
  return (
    <>
      <input
        aria-label={name}
        value={draft}
        inputMode={number ? 'decimal' : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={inputClass}
      />
      {link && (
        <button
          type="button"
          aria-label={`Open ${link}`}
          onClick={(e) => {
            openLink(link, e.ctrlKey || e.metaKey);
          }}
          className="rounded p-1 text-link hover:bg-sunken"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </>
  );
}

function ListValue({
  name,
  items,
  onSet,
  onOpen,
}: {
  name: string;
  items: string[];
  onSet: (value: PropertyValue) => void;
  onOpen: (item: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v) onSet([...items, v]);
    setDraft('');
  };
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 px-1 py-0.5">
      {items.map((item, i) => (
        <span
          key={`${String(i)}:${item}`}
          className="inline-flex items-center rounded-full bg-accent-soft text-xs text-accent"
        >
          <button
            type="button"
            onClick={() => {
              onOpen(item);
            }}
            className="py-0.5 pl-2 hover:underline"
          >
            {item.replace(LINK, '$1')}
          </button>
          <button
            type="button"
            aria-label={`Remove ${item} from ${name}`}
            onClick={() => {
              onSet(items.filter((_, j) => j !== i));
            }}
            className="rounded-full px-1.5 py-0.5 hover:text-text"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        aria-label={`Add to ${name}`}
        value={draft}
        placeholder="Add…"
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
        className="w-20 min-w-0 flex-1 bg-transparent px-1 py-0.5 text-xs focus:outline-none"
      />
    </div>
  );
}

function NewProperty({ taken, onAdd }: { taken: string[]; onAdd: (key: string | null) => void }) {
  const [key, setKey] = useState('');
  const clash = taken.includes(key.trim());
  const done = () => {
    onAdd(key.trim() && !clash ? key.trim() : null);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        aria-label="New property name"
        placeholder="Property name"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
        }}
        onBlur={done}
        onKeyDown={(e) => {
          if (e.key === 'Enter') done();
          if (e.key === 'Escape') onAdd(null);
        }}
        className={cn(inputClass, 'w-36 flex-none border-accent')}
      />
      {clash && <span className="text-xs text-muted">Already a property</span>}
    </div>
  );
}
