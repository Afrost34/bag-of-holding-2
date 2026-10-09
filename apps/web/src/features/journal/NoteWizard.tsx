import {
  fieldLabel,
  isLongField,
  type FieldDef,
  type NoteType,
  type PropertyValue,
} from '@boh/journal';
import { Button, cn } from '@boh/ui';
import { ImagePlus, Images, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NoteTypeIcon } from '../../app/journal/NoteTypeIcon';
import { useAllNoteTypes } from '../../app/journal/noteTypes';
import { useAttachmentUrl } from '../../app/journal/notes/useAttachmentUrl';
import { loadEntity } from '../../app/data/entities';
import { EntitySearch } from '../../app/search/EntitySearch';
import { PictureLibrary } from '../../app/pictures/PictureLibrary';
import { usePictures } from '../../app/pictures/store';
import { userStore } from '../../app/userStore';

/** What the wizard hands back: the note's name and its properties. */
export interface WizardResult {
  name: string;
  /** The kind chosen (it can be picked in the wizard for a plain note). */
  type: NoteType | undefined;
  values: Record<string, PropertyValue>;
  /** A picture chosen in the wizard: saved with the journal only when the wizard is saved. */
  imageFile?: File;
}

export interface WizardHelpers {
  /** Values to suggest for a property (usual values, or notes to link to as `[[Name]]`). */
  suggest: (key: string, field?: FieldDef) => string[];
  /** `[[Note]]` when the text names a note, else null. */
  asLink: (text: string) => string | null;
  /** The journal file an image link points at (for the preview). */
  resolveImage: (target: string) => string | null;
}

const LINK = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;
const linkText = (v: string) => LINK.exec(v)?.[1] ?? v;
/** Properties the wizard does not show as fields. */
const HIDDEN = new Set(['type', 'tags', 'title', 'image', 'banner', 'cover']);

/**
 * Creating or editing an NPC, location, faction… as a short form in steps, instead of editing
 * properties. Also used for plain notes: their properties as a single page, and a kind to give
 * them.
 */
export function NoteWizard({
  mode,
  initialType,
  initialName,
  initialValues,
  helpers,
  onCancel,
  onSave,
}: {
  mode: 'create' | 'edit';
  initialType: NoteType | undefined;
  initialName: string;
  initialValues: Record<string, unknown>;
  helpers: WizardHelpers;
  onCancel: () => void;
  onSave: (result: WizardResult) => void;
}) {
  const [type, setType] = useState(initialType);
  const [name, setName] = useState(initialName);
  const [values, setValues] = useState<Record<string, PropertyValue>>(() => {
    const out: Record<string, PropertyValue> = {};
    for (const [k, v] of Object.entries(initialValues)) out[k] = toPropertyValue(v);
    return out;
  });
  const [extraKeys, setExtraKeys] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // The page behind stays put while the wizard is open (no scrolling it out of place).
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = before;
    };
  }, []);
  const titleId = useId();

  const set = (key: string, value: PropertyValue) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  // Plain notes: their own properties on one page.
  const otherKeys = [
    ...Object.keys(values).filter((k) => !HIDDEN.has(k) && !type?.fields.some((f) => f.key === k)),
    ...extraKeys.filter((k) => !(k in values)),
  ];
  const steps: { label: string; body: ReactNode }[] = type
    ? type.steps.map((s, i) => ({
        label: s.label,
        body: (
          <>
            {i === 0 && <NameField name={name} setName={setName} />}
            {s.keys.map((key) => {
              const field = type.fields.find((f) => f.key === key);
              return field ? (
                <Field
                  key={key}
                  field={field}
                  value={values[key] ?? null}
                  onChange={(v) => {
                    set(key, v);
                  }}
                  helpers={helpers}
                />
              ) : null;
            })}
          </>
        ),
      }))
    : [
        {
          label: 'Details',
          body: (
            <>
              <NameField name={name} setName={setName} />
              <KindPicker
                onPick={(t) => {
                  setType(t);
                  setStep(0);
                }}
              />
              {otherKeys.map((key) => (
                <Field
                  key={key}
                  field={{ key, kind: Array.isArray(values[key]) ? 'list' : 'text' }}
                  value={values[key] ?? null}
                  onChange={(v) => {
                    set(key, v);
                  }}
                  helpers={helpers}
                />
              ))}
              <AddField
                taken={[...Object.keys(values), ...extraKeys]}
                onAdd={(key) => {
                  setExtraKeys((k) => [...k, key]);
                }}
              />
            </>
          ),
        },
      ];
  steps.push({
    label: 'Picture',
    body: (
      <PictureField
        value={values.image ?? values.banner ?? values.cover ?? null}
        file={imageFile}
        onFile={(f) => {
          setImageFile(f);
        }}
        onRemove={() => {
          setImageFile(null);
          set('image', null);
        }}
        helpers={helpers}
      />
    ),
  });

  const last = step === steps.length - 1;
  const clean = name.replace(/[\\/:*?"<>|]/g, '-').trim();
  const save = () => {
    if (!clean) {
      setStep(0);
      return;
    }
    // Names typed in link fields become links (Enter can submit before they are converted).
    const out = { ...values };
    for (const f of type?.fields ?? []) {
      const v = out[f.key];
      if (f.kind === 'link' && typeof v === 'string') out[f.key] = helpers.asLink(v) ?? v;
    }
    onSave({ name: clean, type, values: out, ...(imageFile ? { imageFile } : {}) });
  };
  const verb = mode === 'create' ? 'New' : 'Edit';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full flex-col overflow-hidden rounded-t-xl bg-surface shadow-card sm:max-w-lg sm:rounded-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          {type && <NoteTypeIcon type={type} className="h-5 w-5 text-accent-ink" />}
          <h2 id={titleId} className="flex-1 font-serif text-lg font-bold">
            {verb} {type ? type.label : 'note'}
            {mode === 'edit' && name ? `: ${name}` : ''}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="rounded p-1 text-muted hover:text-text"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        {steps.length > 1 && (
          <nav
            aria-label="Steps"
            className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2"
          >
            {steps.map((s, i) => (
              <button
                key={s.label}
                type="button"
                aria-current={i === step ? 'step' : undefined}
                onClick={() => {
                  setStep(i);
                }}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                  i === step ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-sunken',
                )}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </nav>
        )}
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (last) save();
            else setStep(step + 1);
          }}
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {steps[step]?.body}
          </div>
          <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(step - 1);
                }}
              >
                Back
              </Button>
            )}
            <span className="flex-1" />
            {/* No need to go through every step: the rest can be filled in later. */}
            {!last && (
              <Button type="button" onClick={save}>
                {mode === 'create' ? 'Create' : 'Save'}
              </Button>
            )}
            <Button type="submit" variant="primary">
              {last ? (mode === 'create' ? 'Create' : 'Save') : 'Next'}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function toPropertyValue(v: unknown): PropertyValue {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return JSON.stringify(v);
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm';

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}

function NameField({ name, setName }: { name: string; setName: (n: string) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Name</Label>
      <input
        id={id}
        autoFocus
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        className={inputClass}
      />
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  helpers,
}: {
  field: FieldDef;
  value: PropertyValue;
  onChange: (v: PropertyValue) => void;
  helpers: WizardHelpers;
}) {
  const id = useId();
  const label = fieldLabel(field.key);
  const options = helpers.suggest(field.key, field);
  const linky = field.kind === 'link' || field.kind === 'links';
  const toStored = (text: string): PropertyValue => {
    const t = text.trim();
    if (!t) return null;
    return linky ? (helpers.asLink(t) ?? t) : t;
  };

  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
        />
        {label}
      </label>
    );
  }
  if (field.kind === 'creature') {
    return <CreatureField label={label} value={value} onChange={onChange} />;
  }
  if (field.kind === 'links' || field.kind === 'list') {
    const items = Array.isArray(value) ? value : value ? [String(value)] : [];
    return (
      <ChipsField
        id={id}
        label={label}
        items={items}
        options={options.map(linkText)}
        onChange={(next) => {
          onChange(next.map((t) => (linky ? (helpers.asLink(t) ?? t) : t)));
        }}
      />
    );
  }
  const listId = `${id}-options`;
  const shown = value === null ? '' : linkText(String(value));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {isLongField(field.key) ? (
        <textarea
          id={id}
          rows={3}
          value={shown}
          onChange={(e) => {
            onChange(e.target.value || null);
          }}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
          value={shown}
          list={options.length > 0 ? listId : undefined}
          onChange={(e) => {
            const t = e.target.value;
            if (field.kind === 'number') onChange(t === '' ? null : Number(t));
            else onChange(t === '' ? null : t);
          }}
          onBlur={(e) => {
            if (field.kind !== 'number' && field.kind !== 'date')
              onChange(toStored(e.target.value));
          }}
          placeholder={linky ? 'Pick or type a note' : undefined}
          className={inputClass}
        />
      )}
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={linkText(o)} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function ChipsField({
  id,
  label,
  items,
  options,
  onChange,
}: {
  id: string;
  label: string;
  items: string[];
  options: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v) onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
        {items.map((item, i) => (
          <span
            key={`${String(i)}:${item}`}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-sm text-accent-ink"
          >
            {linkText(item)}
            <button
              type="button"
              aria-label={`Remove ${linkText(item)}`}
              onClick={() => {
                onChange(items.filter((_, j) => j !== i));
              }}
              className="rounded-full p-0.5 hover:text-text"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          list={options.length > 0 ? `${id}-options` : undefined}
          placeholder="Add…"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          className="min-w-24 flex-1 bg-transparent py-1 text-base focus:outline-none sm:text-sm"
        />
      </div>
      {options.length > 0 && (
        <datalist id={`${id}-options`}>
          {options
            .filter((o) => !items.some((i) => linkText(i) === o))
            .map((o) => (
              <option key={o} value={o} />
            ))}
        </datalist>
      )}
    </div>
  );
}

function PictureField({
  value,
  file,
  onFile,
  onRemove,
  helpers,
}: {
  value: PropertyValue;
  file: File | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  helpers: WizardHelpers;
}) {
  const target = typeof value === 'string' ? linkText(value.replace(/^!/, '')) : null;
  const isUrl = target !== null && /^https?:/i.test(target);
  const saved = target && !isUrl ? helpers.resolveImage(target) : null;
  const savedUrl = useAttachmentUrl(saved);
  // A chosen file is shown from a temporary link, released when it changes.
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );
  const src = fileUrl ?? (isUrl ? target : savedUrl);
  const addPicture = usePictures((st) => st.add);
  const [library, setLibrary] = useState(false);
  /** A library picture, handed over as if it were chosen from the disk. */
  const fromLibrary = async (path: string) => {
    const bytes = await (await userStore()).readFile(path);
    if (!bytes) return;
    const name = path.split('/').pop() ?? 'picture.webp';
    const type = name.endsWith('.png')
      ? 'image/png'
      : name.endsWith('.jpg')
        ? 'image/jpeg'
        : 'image/webp';
    onFile(new File([bytes as Uint8Array<ArrayBuffer>], name, { type }));
    setLibrary(false);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        A portrait, a map or any picture: it is shown across the top of the note.
      </p>
      {src ? (
        <img src={src} alt="" className="h-40 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-muted">
          No picture
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-sunken">
          <ImagePlus className="h-4 w-4" aria-hidden />{' '}
          {src ? 'Change picture' : 'Choose a picture'}
          <input
            type="file"
            accept="image/*"
            aria-label="Picture file"
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = '';
              if (!chosen) return;
              onFile(chosen);
              // Kept in the picture library too, for other notes and characters.
              void addPicture(chosen, chosen.name).catch(() => undefined);
            }}
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={library}
          onClick={() => {
            setLibrary(!library);
          }}
        >
          <Images className="h-4 w-4" aria-hidden /> Your pictures
        </Button>
        {(value !== null || file) && (
          <Button type="button" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </Button>
        )}
      </div>
      {library && (
        <PictureLibrary
          onPick={(path) => {
            void fromLibrary(path);
          }}
        />
      )}
    </div>
  );
}

function KindPicker({ onPick }: { onPick: (type: NoteType) => void }) {
  const types = useAllNoteTypes();
  return (
    <div>
      <p className="mb-1 text-sm font-medium">Make it a…</p>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onPick(t);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-sunken"
          >
            <NoteTypeIcon type={t} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddField({ taken, onAdd }: { taken: string[]; onAdd: (key: string) => void }) {
  const [key, setKey] = useState('');
  const id = useId();
  const clean = key.trim().replace(/\s+/g, '_').toLowerCase();
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Label htmlFor={id}>Another detail</Label>
        <input
          id={id}
          value={key}
          placeholder="e.g. Nickname"
          onChange={(e) => {
            setKey(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (clean && !taken.includes(clean)) onAdd(clean);
              setKey('');
            }
          }}
          className={inputClass}
        />
      </div>
      <Button
        type="button"
        disabled={!clean || taken.includes(clean)}
        onClick={() => {
          onAdd(clean);
          setKey('');
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add
      </Button>
    </div>
  );
}

/** A compendium creature (an NPC's stat block): searched, stored as a compendium link. */
function CreatureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PropertyValue;
  onChange: (v: PropertyValue) => void;
}) {
  const current = typeof value === 'string' && value ? linkText(value) : null;
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {current ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="flex-1 font-medium">{current}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
            }}
            className="text-xs text-link hover:underline"
          >
            Remove
          </button>
        </p>
      ) : (
        <p className="text-xs text-muted">
          The creature it fights as: the encounter builder can then add it by name.
        </p>
      )}
      <EntitySearch
        label={label}
        placeholder="Spy, guard, bandit captain…"
        types={['monster']}
        onAdd={(key) => {
          void loadEntity(key).then((e) => {
            if (e) onChange(`[[creature:${e.name}@${e.source}|${e.name}]]`);
          });
        }}
      />
    </div>
  );
}
