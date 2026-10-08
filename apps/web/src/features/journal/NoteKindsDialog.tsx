import { fieldLabel, noteTypeId, type CustomNoteTypeDef, type FieldKind } from '@boh/journal';
import { Button, cn } from '@boh/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { NoteTypeIcon } from '../../app/journal/NoteTypeIcon';
import { ICON_NAMES } from '../../app/journal/noteTypeIcons';
import { useNoteTypes } from '../../app/journal/noteTypes';

const KINDS: { id: FieldKind; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'checkbox', label: 'Yes / no' },
  { id: 'date', label: 'Date' },
  { id: 'link', label: 'Link to a note' },
  { id: 'links', label: 'Links to notes' },
  { id: 'list', label: 'List' },
  { id: 'creature', label: 'Stat block (fights in encounters)' },
];

const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';

/** Turns "Home port" into the property key `home_port`. */
const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/**
 * The campaign's own kinds of notes: Ships, Guilds, Gods of the Deep… Each has a name, an icon
 * and properties; new notes of the kind start with them, and the kind gets its folder, its base
 * and its list in the compendium.
 */
export function NoteKindsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { defs, save } = useNoteTypes();
  const [editing, setEditing] = useState<CustomNoteTypeDef | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEditing(null);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(94vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center">
            <Dialog.Title className="flex-1 font-serif text-xl font-bold">
              Kinds of notes
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded p-1 text-muted hover:bg-sunken">
              <X className="h-4 w-4" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-muted">
            Besides NPCs, locations, factions and the rest, make kinds of your own: ships, guilds,
            artefacts… with the properties every one of them has.
          </Dialog.Description>
          {editing ? (
            <KindForm
              kind={editing}
              isNew={!defs.some((d) => d.id === editing.id)}
              onCancel={() => {
                setEditing(null);
              }}
              onSave={(kind) => {
                const others = defs.filter((d) => d.id !== kind.id);
                void save([...others, kind]);
                setEditing(null);
              }}
            />
          ) : (
            <>
              {defs.length > 0 && (
                <ul
                  aria-label="Your kinds"
                  className="mb-3 divide-y divide-border rounded-md border border-border"
                >
                  {defs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                      <NoteTypeIcon type={d} className="h-4 w-4 text-muted" />
                      <span className="flex-1 font-medium">{d.plural}</span>
                      <span className="text-xs text-muted">{d.fields.length} properties</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(d);
                        }}
                      >
                        Edit
                      </Button>
                      <button
                        type="button"
                        aria-label={`Delete the kind ${d.label}`}
                        onClick={() => {
                          void save(defs.filter((x) => x.id !== d.id));
                        }}
                        className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  setEditing({ id: '', label: '', plural: '', icon: 'file', fields: [] });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden /> New kind
              </Button>
              <p className="mt-3 text-xs text-muted">
                Notes keep their properties when a kind is deleted; they just stop being listed as
                that kind.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function KindForm({
  kind,
  isNew,
  onSave,
  onCancel,
}: {
  kind: CustomNoteTypeDef;
  isNew: boolean;
  onSave: (kind: CustomNoteTypeDef) => void;
  onCancel: () => void;
}) {
  const { defs } = useNoteTypes();
  const [label, setLabel] = useState(kind.label);
  const [plural, setPlural] = useState(kind.plural);
  const [icon, setIcon] = useState(kind.icon);
  const [fields, setFields] = useState(kind.fields.map((f) => ({ ...f, name: fieldLabel(f.key) })));
  const ok = label.trim().length > 0 && fields.every((f) => keyOf(f.name));
  return (
    <form
      aria-label={isNew ? 'New kind of note' : `Edit ${kind.label}`}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        const id = isNew
          ? noteTypeId(
              label,
              defs.map((d) => d.id),
            )
          : kind.id;
        onSave({
          id,
          label: label.trim(),
          plural: plural.trim() || `${label.trim()}s`,
          icon,
          fields: fields.map(({ name, ...f }) => ({ ...f, key: keyOf(name) })),
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Name (one)
          <input
            value={label}
            autoFocus
            placeholder="Ship"
            onChange={(e) => {
              setLabel(e.target.value);
            }}
            className={field}
          />
        </label>
        <label className="text-sm">
          Name (many)
          <input
            value={plural}
            placeholder={label ? `${label}s` : 'Ships'}
            onChange={(e) => {
              setPlural(e.target.value);
            }}
            className={field}
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm">Icon</legend>
        <div className="flex flex-wrap gap-1">
          {ICON_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={`Icon ${name}`}
              aria-pressed={icon === name}
              onClick={() => {
                setIcon(name);
              }}
              className={cn(
                'rounded-md border p-1.5',
                icon === name ? 'border-accent bg-accent-soft' : 'border-border hover:bg-sunken',
              )}
            >
              <NoteTypeIcon type={{ icon: name }} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm">Properties</legend>
        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
            <input
              value={f.name}
              aria-label={`Property ${String(i + 1)} name`}
              placeholder="Captain"
              onChange={(e) => {
                const name = e.target.value;
                setFields(fields.map((x, j) => (j === i ? { ...x, name } : x)));
              }}
              className={field}
            />
            <select
              value={f.kind}
              aria-label={`Property ${String(i + 1)} kind`}
              onChange={(e) => {
                const k = e.target.value as FieldKind;
                setFields(fields.map((x, j) => (j === i ? { ...x, kind: k } : x)));
              }}
              className={field}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Remove property ${f.name || String(i + 1)}`}
              onClick={() => {
                setFields(fields.filter((_, j) => j !== i));
              }}
              className="rounded p-1 text-muted hover:bg-sunken"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFields([...fields, { key: '', name: '', kind: 'text' }]);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a property
        </Button>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!ok}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
