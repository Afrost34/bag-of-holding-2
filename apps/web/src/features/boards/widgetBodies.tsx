import { NOTE_TYPES, newNoteText, setProperty } from '@boh/journal';
import { Button, cn } from '@boh/ui';
import {
  Backpack,
  BookOpen,
  ExternalLink,
  NotebookPen,
  ScrollText,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import type { BoardCard } from '../../app/boards/model';
import { generateNpc, NPC_SPECIES } from '../../app/boards/npc';
import { CharacterSheetCard } from '../../app/characters/CharacterSheetCard';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { MapScene } from '../../app/maps/scene';
import { useMaps } from '../../app/maps/store';
import { useAppNavigate } from '../../app/navigation';
import { useBoardActions, useIsPlayersBoard } from './context';
import { pinLink } from '../../app/maps/pinLink';
import type { CardContent } from '../../app/boards/model';

/**
 * Board widgets beyond notes and entries: a map to look at, a character at a glance, and an NPC
 * made up on the spot.
 */

/** A map of the Maps module, to pan and zoom (edited in the map maker). */
/**
 * A point of the page in the map's own pixels: the board may be zoomed, so the card is drawn
 * smaller or larger on screen than its canvas is.
 */
function localPoint(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const kx = r.width ? el.clientWidth / r.width : 1;
  const ky = r.height ? el.clientHeight / r.height : 1;
  return { x: (clientX - r.left) * kx, y: (clientY - r.top) * ky };
}

export function MapBody({ card }: { card: Extract<BoardCard, { kind: 'map' }> }) {
  const doc = useMaps((s) => s.maps.find((m) => m.id === card.map));
  const { loaded, load } = useMaps();
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MapScene | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const actions = useBoardActions();
  const forPlayers = useIsPlayersBoard();
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  useEffect(() => {
    const el = host.current;
    if (!el || !doc) return;
    const s = new MapScene();
    s.followResize = true;
    s.forPlayers = forPlayers;
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
      const at = localPoint(el, e.clientX, e.clientY);
      scene.zoomAt(at.x, at.y, Math.exp(-e.deltaY * 0.0015));
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
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !scene) return;
          // The map follows the pointer however far the board is zoomed.
          const r = e.currentTarget.getBoundingClientRect();
          const k = r.width ? e.currentTarget.clientWidth / r.width : 1;
          scene.panBy((e.clientX - drag.current.x) * k, (e.clientY - drag.current.y) * k);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          drag.current = null;
          // A click (not a drag) on a pin opens where it leads, beside the map.
          const from = downAt.current;
          const el = host.current;
          if (!scene || !el || !from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5)
            return;
          const at = localPoint(el, e.clientX, e.clientY);
          const hit = scene.hit(scene.toMap(at.x, at.y));
          const link = hit?.kind === 'pin' ? pinLink(hit) : null;
          if (!link) return;
          const content: CardContent =
            link.kind === 'note'
              ? { kind: 'note', path: link.path }
              : link.kind === 'map'
                ? { kind: 'map', map: link.id }
                : { kind: 'entity', key: link.key };
          actions.addBeside(card.id, [content]);
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

const SECTIONS = [
  { part: 'spells', label: 'Spells', Icon: Sparkles },
  { part: 'features', label: 'Features', Icon: ScrollText },
  { part: 'inventory', label: 'Inventory', Icon: Backpack },
  { part: 'story', label: 'Story', Icon: BookOpen },
] as const;

/**
 * A character as the first page of its sheet; the rail on the card's side opens and closes its
 * spells, features, inventory and story.
 */
export function CharacterBody({ card }: { card: Extract<BoardCard, { kind: 'character' }> }) {
  const { update } = useBoardActions();
  const toggle = (part: (typeof SECTIONS)[number]['part']) => {
    update(card.id, (c) =>
      c.kind === 'character' ? { ...c, show: { ...c.show, [part]: !c.show[part] } } : c,
    );
  };
  return (
    <div className="-m-3 flex h-[calc(100%+1.5rem)]">
      <div
        role="group"
        aria-label="Sections"
        className="flex shrink-0 flex-col gap-1 border-r border-border bg-surface-2 p-1"
      >
        {SECTIONS.map(({ part, label, Icon }) => (
          <button
            key={part}
            type="button"
            aria-pressed={card.show[part] === true}
            aria-label={label}
            title={label}
            onClick={() => {
              toggle(part);
            }}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold',
              card.show[part]
                ? 'bg-accent text-accent-fg'
                : 'text-muted hover:bg-sunken hover:text-text',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-3">
        <CharacterSheetCard characterId={card.character} show={card.show} />
      </div>
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
