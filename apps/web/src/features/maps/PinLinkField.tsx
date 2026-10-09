import { Button } from '@boh/ui';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { entityPath } from '../../app/data/entities';
import { journalPath } from '../../app/journal/paths';
import type { MapDoc, MapItem } from '../../app/maps/model';
import { pinLink, withPinLink, type PinLink } from '../../app/maps/pinLink';
import { useAppNavigate } from '../../app/navigation';
import { NotePicker } from '../../app/journal/NotePicker';
import { EntitySearch } from '../../app/search/EntitySearch';
import { EntryName } from '../../app/tables/TableRoller';

type Pin = Extract<MapItem, { kind: 'pin' }>;

const field = 'mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';

const KINDS: { id: PinLink['kind'] | ''; label: string }[] = [
  { id: '', label: 'Nothing' },
  { id: 'note', label: 'A journal note' },
  { id: 'map', label: 'Another map' },
  { id: 'entity', label: 'A compendium entry' },
];

/**
 * What a pin leads to (one thing, followed by clicking the pin) and whether the players see it.
 */
export function PinLinkField({
  pin,
  doc,
  notes,
  maps,
  set,
}: {
  pin: Pin;
  doc: MapDoc;
  /** The campaign's journal notes. */
  notes: readonly string[];
  /** The other maps it can lead to. */
  maps: readonly MapDoc[];
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const navigate = useAppNavigate();
  const link = pinLink(pin);
  const [kind, setKind] = useState<PinLink['kind'] | ''>(link?.kind ?? '');
  const setLink = (next: PinLink | null) => {
    set((i) => (i.kind === 'pin' ? withPinLink(i, next) : i));
  };
  const to = link
    ? link.kind === 'note'
      ? journalPath(link.path)
      : link.kind === 'map'
        ? `/maps/${link.id}`
        : entityPath(link.key)
    : null;
  return (
    <>
      <label className="block text-sm">
        Leads to
        <select
          value={kind}
          aria-label="Pin leads to"
          onChange={(e) => {
            const next = KINDS.find((k) => k.id === e.target.value)?.id ?? '';
            setKind(next);
            if (next === '') setLink(null);
          }}
          className={field}
        >
          {KINDS.filter((k) => k.id !== 'note' || doc.campaign).map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {kind === 'note' && (
        <>
          {link?.kind === 'note' && (
            <p className="text-sm">
              Note: <strong>{(link.path.split('/').pop() ?? '').replace(/\.md$/i, '')}</strong>
            </p>
          )}
          <NotePicker
            notes={notes}
            label="Pin note"
            onPick={(path) => {
              setLink({ kind: 'note', path });
            }}
          />
        </>
      )}
      {kind === 'map' && (
        <select
          value={link?.kind === 'map' ? link.id : ''}
          aria-label="Pin map"
          onChange={(e) => {
            setLink(e.target.value ? { kind: 'map', id: e.target.value } : null);
          }}
          className={field}
        >
          <option value="">Pick a map…</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      {kind === 'entity' && (
        <>
          {link?.kind === 'entity' && (
            <p className="text-sm">
              <EntryName entryKey={link.key} />
            </p>
          )}
          <EntitySearch
            label="Pin entry"
            placeholder="A creature, an item, a spell…"
            onAdd={(key) => {
              setLink({ kind: 'entity', key });
            }}
          />
        </>
      )}
      {to && (
        <Button
          variant="ghost"
          onClick={() => {
            navigate(to);
          }}
        >
          <ExternalLink className="h-4 w-4" aria-hidden /> Open what it leads to
        </Button>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pin.secret === true}
          onChange={(e) => {
            const secret = e.target.checked;
            set((i) => {
              if (i.kind !== 'pin') return i;
              const { secret: _s, ...rest } = i;
              return secret ? { ...rest, secret: true } : rest;
            });
          }}
        />
        Hidden from players
      </label>
      <p className="text-xs text-muted">
        Click a pin to follow it: with the Pan tool or in full page here, and on boards, where it
        opens beside the map.
      </p>
    </>
  );
}
