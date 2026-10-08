import { NOTE_TYPES, newNoteText, setProperty } from '@boh/journal';
import { Button } from '@boh/ui';
import { ExternalLink, NotebookPen, Shuffle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import type { BoardCard } from '../../app/boards/model';
import { generateNpc, NPC_SPECIES } from '../../app/boards/npc';
import { CharacterCard } from '../../app/characters/CharacterCard';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { MapScene } from '../../app/maps/scene';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';
import { useBoardActions } from './context';

/**
 * Board widgets beyond notes and entries: a map to look at, a character at a glance, and an NPC
 * made up on the spot.
 */

/** A map of the Maps module, to pan and zoom (edited in the map maker). */
export function MapBody({ card }: { card: Extract<BoardCard, { kind: 'map' }> }) {
  const doc = useMaps((s) => s.maps.find((m) => m.id === card.map));
  const { loaded, load } = useMaps();
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MapScene | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  useEffect(() => {
    const el = host.current;
    if (!el || !doc) return;
    const s = new MapScene();
    s.followResize = true;
    let live = true;
    void s.init(el).then(() => {
      if (!live) return;
      s.setDoc(doc);
      s.fit();
      setScene(s);
    });
    return () => {
      live = false;
      s.destroy();
    };
    // One canvas per map; changes to it arrive through setDoc below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);
  useEffect(() => {
    if (doc) scene?.setDoc(doc);
  }, [scene, doc]);
  useEffect(() => {
    const el = host.current;
    if (!el || !scene) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      scene.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [scene]);
  if (!doc) return <p className="text-muted">This map no longer exists.</p>;
  return (
    <div className="-m-3 flex h-[calc(100%+1.5rem)] flex-col">
      <div
        ref={host}
        role="img"
        aria-label={`Map: ${doc.name}`}
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-sunken"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !scene) return;
          scene.panBy(e.clientX - drag.current.x, e.clientY - drag.current.y);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
      <div className="flex justify-end border-t border-border px-2 py-1">
        <AppLink
          to={`/maps/${doc.id}`}
          className="inline-flex items-center gap-1 text-xs text-link hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in the map maker
        </AppLink>
      </div>
    </div>
  );
}

/** A character at a glance; the DM picks which sections show. */
export function CharacterBody({ card }: { card: Extract<BoardCard, { kind: 'character' }> }) {
  const { update } = useBoardActions();
  const toggle = (part: keyof typeof card.show) => {
    update(card.id, (c) =>
      c.kind === 'character' ? { ...c, show: { ...c.show, [part]: !c.show[part] } } : c,
    );
  };
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Show" className="flex flex-wrap gap-3 text-xs">
        {(['spells', 'features', 'inventory'] as const).map((part) => (
          <label key={part} className="flex items-center gap-1 capitalize">
            <input
              type="checkbox"
              checked={card.show[part]}
              onChange={() => {
                toggle(part);
              }}
            />
            {part}
          </label>
        ))}
      </div>
      <CharacterCard characterId={card.character} show={card.show} />
    </div>
  );
}

const NPC_LINES: [keyof ReturnType<typeof generateNpc>, string][] = [
  ['occupation', 'Occupation'],
  ['appearance', 'Looks'],
  ['personality', 'Manner'],
  ['voice', 'Voice'],
  ['wants', 'Wants'],
  ['secret', 'Secret'],
];

/** An NPC made up on the spot: roll again, or keep it as a journal note. */
export function NpcBody({ card }: { card: Extract<BoardCard, { kind: 'npc' }> }) {
  const { update } = useBoardActions();
  const navigate = useAppNavigate();
  const journalCampaign = useJournal((s) => s.campaignId);
  const createNote = useJournal((s) => s.createNote);
  const [species, setSpecies] = useState('');
  const npc = card.npc;
  const save = async () => {
    const type = NOTE_TYPES.find((t) => t.id === 'npc');
    if (!type) return;
    let text = newNoteText(type, npc.name);
    text = setProperty(text, 'race', npc.species);
    text = setProperty(text, 'role', npc.occupation);
    text = setProperty(text, 'motivation', npc.wants);
    text = setProperty(text, 'secret', npc.secret);
    text += `\nA ${npc.age} ${npc.species.toLowerCase()} ${npc.gender}, ${npc.occupation}: ${npc.appearance}; ${npc.personality}; ${npc.voice}.\n`;
    const path = await createNote(type.folder, npc.name, text);
    navigate(journalPath(path));
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">
        A {npc.age} {npc.species.toLowerCase()} {npc.gender}
      </p>
      <dl className="space-y-1">
        {NPC_LINES.map(([key, label]) => (
          <div key={key} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-xs font-semibold text-muted uppercase">{label}</dt>
            <dd>{npc[key]}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <select
          value={species}
          aria-label="Species"
          onChange={(e) => {
            setSpecies(e.target.value);
          }}
          className="rounded border border-border bg-surface px-1 py-1 text-xs"
        >
          <option value="">Any species</option>
          {NPC_SPECIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          onClick={() => {
            const next = generateNpc(Math.random, species || undefined);
            update(card.id, (c) => (c.kind === 'npc' ? { ...c, npc: next } : c));
          }}
        >
          <Shuffle className="h-4 w-4" aria-hidden /> Another
        </Button>
        {journalCampaign && (
          <Button variant="ghost" onClick={() => void save()}>
            <NotebookPen className="h-4 w-4" aria-hidden /> Keep as a note
          </Button>
        )}
      </div>
    </div>
  );
}
