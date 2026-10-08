import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath, useEntity } from '../../app/data/entities';
import { useEncounters } from '../../app/encounters/store';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { useAppNavigate } from '../../app/navigation';
import { EntitySearch } from '../../app/search/EntitySearch';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import {
  addLink,
  addRow,
  describeLink,
  encounterLink,
  formatRange,
  moveRow,
  noteLink,
  removeLink,
  removeRow,
  rowRanges,
  TABLE_KINDS,
  tableDie,
  updateRow,
  validCount,
  type RollTable,
  type TableLink,
  type TableRow,
} from '../../app/tables/model';
import { useTable, useTables } from '../../app/tables/store';
import { EntryName, RowPrice, TableRoller } from '../../app/tables/TableRoller';

/** One roll table: its rows, rolling it, and what it is linked to. */
export function TablePage({ id }: { id: string }) {
  const { loaded, load, save, remove } = useTables();
  const table = useTable(id);
  const { loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const navigate = useAppNavigate();
  usePageTitle(table?.name ?? 'Table');
  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
  }, [loaded, load, campaignsLoaded, loadCampaigns]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [text, setText] = useState('');

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!table) return <p className="p-8">This table does not exist (any more).</p>;

  /** Changes the table as stored now (several quick clicks build on each other). */
  const change = (fn: (t: RollTable) => RollTable) => {
    const current = useTables.getState().tables.find((t) => t.id === id);
    if (current) save(fn(current));
  };
  const kind = TABLE_KINDS.find((k) => k.id === table.kind) ?? TABLE_KINDS[0];
  const ranges = new Map(rowRanges(table).map((r) => [r.id, r]));
  const shop = table.kind === 'shop';

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <AppLink
          to="/tables"
          aria-label="All tables"
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </AppLink>
        <NameInput
          key={table.name}
          name={table.name}
          onRename={(name) => {
            change((t) => ({ ...t, name }));
          }}
        />
        <select
          value={table.kind}
          aria-label="Kind of table"
          onChange={(e) => {
            const next = TABLE_KINDS.find((k) => k.id === e.target.value);
            if (next) change((t) => ({ ...t, kind: next.id }));
          }}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {TABLE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          aria-label="Delete table"
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="Delete this table?"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm"
        >
          <span className="flex-1">Delete “{table.name}”?</span>
          <Button
            variant="primary"
            onClick={() => {
              void remove(table.id).then(() => {
                navigate('/tables');
              });
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmDelete(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
        <section aria-label="Rows" className="space-y-3">
          <EntitySearch
            label={kind?.entry === 'monster' ? 'Add a creature' : 'Add an item'}
            placeholder={
              kind?.entry === 'monster' ? 'Add a creature: goblin, wolf…' : 'Add an item: potion…'
            }
            types={[kind?.entry ?? 'item']}
            onAdd={(key) => {
              change((t) => addRow(t, { key }));
            }}
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              change((t) => addRow(t, { text }));
              setText('');
            }}
          >
            <input
              value={text}
              aria-label="Add a row of text"
              placeholder={
                shop ? 'Or some text: a room for the night' : 'Or some text: 2d6 × 10 gp'
              }
              onChange={(e) => {
                setText(e.target.value);
              }}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
            />
            <Button type="submit" variant="ghost" disabled={!text.trim()}>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          </form>
          {table.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted">
              No rows yet: add some above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">d{tableDie(table)}</th>
                    <th className="px-2 py-1.5 font-semibold">Weight</th>
                    <th className="px-2 py-1.5 font-semibold">Entry</th>
                    <th className="px-2 py-1.5 font-semibold">How many</th>
                    {shop && <th className="px-2 py-1.5 font-semibold">Price</th>}
                    <th className="px-2 py-1.5">
                      <span className="sr-only">Order</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {table.rows.map((row, i) => (
                    <RowEditor
                      key={row.id}
                      row={row}
                      range={formatRange(ranges.get(row.id) ?? { from: 0, to: 0 })}
                      shop={shop}
                      first={i === 0}
                      last={i === table.rows.length - 1}
                      onChange={(patch) => {
                        change((t) => updateRow(t, row.id, patch));
                      }}
                      onMove={(by) => {
                        change((t) => moveRow(t, row.id, by));
                      }}
                      onRemove={() => {
                        change((t) => removeRow(t, row.id));
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notes</span>
            <textarea
              value={table.notes ?? ''}
              rows={3}
              placeholder={shop ? 'The shopkeeper, haggling, opening hours…' : 'When to roll…'}
              onChange={(e) => {
                const notes = e.target.value;
                change((t) => ({ ...t, notes }));
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
        </section>
        <div className="space-y-4">
          <aside
            aria-label="Roll"
            className="space-y-3 rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="font-serif text-lg font-bold">Roll</h2>
            <TableRoller table={table} />
          </aside>
          <Links table={table} onChange={change} />
        </div>
      </div>
    </div>
  );
}

function NameInput({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      value={value}
      aria-label="Table name"
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onBlur={() => {
        if (value.trim() && value !== name) onRename(value.trim());
      }}
      className="min-w-0 flex-1 rounded bg-transparent px-1 font-serif text-2xl font-bold focus:bg-sunken focus:outline-none"
    />
  );
}

/** A text field saved when it loses focus (or on Enter). */
function BlurInput({
  value,
  label,
  placeholder,
  invalid,
  className,
  onSave,
}: {
  value: string;
  label: string;
  placeholder?: string;
  invalid?: (v: string) => boolean;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const bad = invalid?.(draft) ?? false;
  return (
    <input
      value={draft}
      aria-label={label}
      aria-invalid={bad || undefined}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={() => {
        if (!bad && draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={cn(
        'w-full rounded border bg-surface px-1.5 py-0.5',
        bad ? 'border-str' : 'border-border',
        className,
      )}
    />
  );
}

function RowEditor({
  row,
  range,
  shop,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  row: TableRow;
  range: string;
  shop: boolean;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<Omit<TableRow, 'id'>>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const entity = useEntity(row.key ?? null);
  const name =
    row.key && entity.status === 'found' ? entity.entity.name : (row.text ?? row.key ?? '');
  return (
    <tr aria-label={name}>
      <td className="px-2 py-1 font-mono text-xs whitespace-nowrap text-muted tabular-nums">
        {range}
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          min={1}
          max={100}
          value={row.weight}
          aria-label={`Weight of ${name}`}
          onChange={(e) => {
            onChange({ weight: Number(e.target.value) });
          }}
          className="w-14 rounded border border-border bg-surface px-1.5 py-0.5"
        />
      </td>
      <td className="min-w-48 px-2 py-1">
        {row.key && (
          <div className="mb-0.5">
            <EntryName entryKey={row.key} />
          </div>
        )}
        <BlurInput
          value={row.text ?? ''}
          label={`Text of ${name}`}
          placeholder={row.key ? 'More: “led by a hobgoblin”' : ''}
          {...(row.key ? {} : { invalid: (v: string) => !v.trim() })}
          onSave={(text) => {
            onChange({ text });
          }}
        />
      </td>
      <td className="px-2 py-1">
        <BlurInput
          value={row.count ?? ''}
          label={`How many of ${name}`}
          placeholder="1"
          invalid={(v) => v.trim() !== '' && !validCount(v)}
          className="w-20"
          onSave={(count) => {
            onChange({ count });
          }}
        />
      </td>
      {shop && (
        <td className="px-2 py-1">
          <BlurInput
            value={row.price ?? ''}
            label={`Price of ${name}`}
            className="w-24"
            placeholder={row.key ? 'its value' : '5 sp'}
            onSave={(price) => {
              onChange({ price });
            }}
          />
          {!row.price && row.key && (
            <span className="text-xs text-muted">
              <RowPrice row={row} />
            </span>
          )}
        </td>
      )}
      <td className="px-1 py-1 whitespace-nowrap">
        <button
          type="button"
          aria-label={`Move ${name} up`}
          disabled={first}
          onClick={() => {
            onMove(-1);
          }}
          className="rounded p-1 text-muted hover:bg-sunken disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Move ${name} down`}
          disabled={last}
          onClick={() => {
            onMove(1);
          }}
          className="rounded p-1 text-muted hover:bg-sunken disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

/** What the table is linked to: notes, encounters and creatures show it, ready to roll. */
function Links({
  table,
  onChange,
}: {
  table: RollTable;
  onChange: (fn: (t: RollTable) => RollTable) => void;
}) {
  const journal = useJournal();
  const { encounters, loaded: encountersLoaded, load: loadEncounters } = useEncounters();
  useEffect(() => {
    if (!encountersLoaded) void loadEncounters();
  }, [encountersLoaded, loadEncounters]);
  // The notes to link are the table's campaign's.
  useEffect(() => {
    if (table.campaign && journal.campaignId !== table.campaign) void journal.load(table.campaign);
  }, [table.campaign, journal]);
  const notes =
    table.campaign && journal.campaignId === table.campaign
      ? [...journal.notes.keys()].sort((a, b) => a.localeCompare(b, 'en'))
      : [];
  const [note, setNote] = useState('');
  const link = (l: TableLink) => {
    onChange((t) => addLink(t, l));
  };
  const sameCampaign = encounters.filter(
    (e) => e.campaign === table.campaign && !table.links.includes(encounterLink(e.id)),
  );
  return (
    <aside
      aria-label="Linked to"
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="font-serif text-lg font-bold">Linked to</h2>
      <p className="text-xs text-muted">
        Linked notes, encounters and creatures show this table, ready to roll. Link an encounter
        table to a location for its region’s random encounters.
      </p>
      {table.links.length > 0 && (
        <ul className="space-y-1 text-sm">
          {table.links.map((l) => (
            <li key={l} className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate">
                <LinkLabel link={l} />
              </span>
              <button
                type="button"
                aria-label={`Unlink ${l}`}
                onClick={() => {
                  onChange((t) => removeLink(t, l));
                }}
                className="rounded p-0.5 text-muted hover:bg-sunken hover:text-text"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const path = notes.find((p) => p === note || p === `${note}.md`);
            if (path) link(noteLink(path));
            setNote('');
          }}
        >
          <input
            value={note}
            list="table-link-notes"
            aria-label="Link a note"
            placeholder="Link a note: an NPC, a location…"
            onChange={(e) => {
              setNote(e.target.value);
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm"
          />
          <datalist id="table-link-notes">
            {notes.map((p) => (
              <option key={p} value={p.replace(/\.md$/i, '')} />
            ))}
          </datalist>
          <Button type="submit" variant="ghost" aria-label="Link the note">
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      )}
      {sameCampaign.length > 0 && (
        <select
          value=""
          aria-label="Link an encounter"
          onChange={(e) => {
            if (e.target.value) link(encounterLink(e.target.value));
          }}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="">Link an encounter…</option>
          {sameCampaign.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      )}
      <EntitySearch
        label="Link a creature or item"
        placeholder="Link a creature or item…"
        types={['monster', 'item']}
        onAdd={(key) => {
          link(key);
        }}
      />
    </aside>
  );
}

function LinkLabel({ link }: { link: TableLink }) {
  const what = describeLink(link);
  const encounter = useEncounters((s) =>
    what.kind === 'encounter' ? s.encounters.find((e) => e.id === what.id) : undefined,
  );
  if (what.kind === 'note')
    return (
      <AppLink to={journalPath(what.path)} className="text-link hover:underline">
        {what.path.split('/').pop()?.replace(/\.md$/i, '')}
      </AppLink>
    );
  if (what.kind === 'encounter')
    return (
      <AppLink to={`/encounters/${what.id}`} className="text-link hover:underline">
        {encounter?.name ?? 'An encounter'}
      </AppLink>
    );
  return (
    <>
      <EntryName entryKey={what.key} />{' '}
      <AppLink to={entityPath(what.key)} className="text-xs text-muted">
        ({what.key.split(':')[0]})
      </AppLink>
    </>
  );
}
