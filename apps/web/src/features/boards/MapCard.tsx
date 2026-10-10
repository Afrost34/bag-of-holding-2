import { cn } from '@boh/ui';
import { useReactFlow } from '@xyflow/react';
import {
  ExternalLink,
  Lock,
  LockOpen,
  Hand,
  Maximize,
  Ruler,
  Triangle,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import type { BoardCard, CardContent } from '../../app/boards/model';
import { templateOutline } from '../../app/maps/geometry';
import { useLiveMaps } from '../../app/maps/useLiveMaps';
import { measurePath, measurePoint } from '../../app/maps/measure';
import type { TemplateShape } from '../../app/maps/model';
import { PinHover } from '../../app/maps/PinHover';
import { parsePagePath } from '../../app/maps/pages';
import { pinLink } from '../../app/maps/pinLink';
import { useAppNavigate } from '../../app/navigation';
import { MapScene } from '../../app/maps/scene';
import { useMaps } from '../../app/maps/store';
import { useBoardActions, useIsPlayersBoard } from './context';

interface Point {
  x: number;
  y: number;
}
type Tool = 'look' | 'measure' | 'range';

/**
 * A point of the page in the map's own pixels: the board may be zoomed, so the card is drawn
 * smaller or larger on screen than its canvas is.
 */
function localPoint(el: HTMLElement, clientX: number, clientY: number): Point {
  const r = el.getBoundingClientRect();
  const kx = r.width ? el.clientWidth / r.width : 1;
  const ky = r.height ? el.clientHeight / r.height : 1;
  return { x: (clientX - r.left) * kx, y: (clientY - r.top) * ky };
}

/**
 * A map of the Maps module on a board (edited in the map maker). Drag to look around, the
 * buttons zoom (the wheel zooms the board, not the map), a click on a pin opens where it leads
 * beside the map, and the ruler measures a path: each click adds a point, the total is shown
 * as you go, with travel times on maps with a scale.
 */
export function MapBody({ card }: { card: Extract<BoardCard, { kind: 'map' }> }) {
  const doc = useMaps((s) => s.maps.find((m) => m.id === card.map));
  const { loaded, load } = useMaps();
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MapScene | null>(null);
  const [tool, setTool] = useState<Tool>('look');
  const [path, setPath] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  /** Bumped when the view changes, so the measure is drawn again at the new zoom. */
  const [view, setView] = useState(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const actions = useBoardActions();
  const navigate = useAppNavigate();
  const flow = useReactFlow();
  const locked = card.locked === true;
  const forPlayers = useIsPlayersBoard();
  // In the player window the DM's changes (fog, variants, pins) arrive live.
  useLiveMaps(forPlayers);
  /** A range to show (spell cone, sphere…), measured in feet: never kept on the map. */
  const [range, setRange] = useState<{ shape: TemplateShape; feet: number }>({
    shape: 'cone',
    feet: 15,
  });
  const rangeFrom = useRef<Point | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  useEffect(() => {
    const el = host.current;
    if (!el || !doc) return;
    const s = new MapScene();
    s.followResize = true;
    s.forPlayers = forPlayers;
    s.useRender = true;
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

  const basis = doc ? { scale: doc.scale, travel: doc.travel, grid: doc.grid } : null;
  // The path so far, and the leg to the pointer while measuring.
  const shown = useMemo(
    () => (hover && tool === 'measure' && path.length > 0 ? [...path, hover] : path),
    [hover, tool, path],
  );
  const total = basis ? measurePath(shown, basis) : null;
  useEffect(() => {
    if (!scene) return;
    if (shown.length === 0) scene.clearPreview();
    else scene.drawMeasure(shown, total);
  }, [scene, shown, total, view]);

  if (!doc || !basis) return <p className="text-muted">This map no longer exists.</p>;
  const zoom = (factor: number) => {
    const el = host.current;
    if (!scene || !el) return;
    scene.zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
    setView((v) => v + 1);
  };
  const pick = (next: Tool) => {
    setTool(next);
    setPath([]);
    setHover(null);
  };
  const toMap = (clientX: number, clientY: number) => {
    const el = host.current;
    if (!scene || !el) return null;
    const at = localPoint(el, clientX, clientY);
    return scene.toMap(at.x, at.y);
  };

  return (
    <div className="-m-3 flex h-[calc(100%+1.5rem)] flex-col">
      <div
        role="toolbar"
        aria-label="Map tools"
        className="flex items-center gap-0.5 border-b border-border px-1 py-0.5"
      >
        <ToolButton
          label="Look around"
          Icon={Hand}
          pressed={tool === 'look'}
          onClick={() => {
            pick('look');
          }}
        />
        {doc.kind !== 'world' && (
          <ToolButton
            label="Range"
            Icon={Triangle}
            pressed={tool === 'range'}
            onClick={() => {
              pick('range');
            }}
          />
        )}
        <ToolButton
          label="Measure"
          Icon={Ruler}
          pressed={tool === 'measure'}
          onClick={() => {
            pick('measure');
          }}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          label="Zoom in"
          Icon={ZoomIn}
          disabled={locked}
          onClick={() => {
            zoom(1.25);
          }}
        />
        <ToolButton
          label="Zoom out"
          Icon={ZoomOut}
          disabled={locked}
          onClick={() => {
            zoom(0.8);
          }}
        />
        <ToolButton
          label="Fit the map"
          Icon={Maximize}
          disabled={locked}
          onClick={() => {
            scene?.fit();
            setView((v) => v + 1);
          }}
        />
        <span className="flex-1" />
        <ToolButton
          label={locked ? 'Unlock the map' : 'Lock the map'}
          Icon={locked ? Lock : LockOpen}
          pressed={locked}
          onClick={() => {
            actions.update(card.id, (c) => {
              if (c.kind !== 'map') return c;
              const { locked: _was, ...rest } = c;
              return locked ? rest : { ...rest, locked: true };
            });
          }}
        />
      </div>
      <div
        ref={host}
        role="img"
        aria-label={`Map: ${doc.name}`}
        // Drags here move the map only (React Flow would also pan the board on a middle-button
        // drag): `nopan`, and the press stops at the map.
        className={cn(
          'nopan relative min-h-0 flex-1 touch-none overflow-hidden bg-sunken',
          tool === 'look' ? 'cursor-grab' : 'cursor-crosshair',
        )}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          if (e.button === 1) e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (tool === 'range') {
            rangeFrom.current = toMap(e.clientX, e.clientY);
            return;
          }
          drag.current = { x: e.clientX, y: e.clientY };
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (tool === 'range' && rangeFrom.current && scene) {
            const to = toMap(e.clientX, e.clientY);
            const from = rangeFrom.current;
            if (!to) return;
            const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
            const o = templateOutline(range.shape, from, range.feet, angle, doc.grid);
            scene.drawPreview(
              (g) => {
                if (o.circle) g.circle(o.circle.x, o.circle.y, o.circle.r);
                if (o.polygon) g.poly(o.polygon.flatMap((q) => [q.x, q.y]));
                g.fill({ color: 0xdc2626, alpha: 0.25 }).stroke({ color: 0xdc2626, width: 3 });
              },
              { text: `${String(range.feet)} ft ${range.shape}`, at: to },
            );
            return;
          }
          if (tool === 'measure' && !drag.current) {
            const p = toMap(e.clientX, e.clientY);
            setHover(p ? measurePoint(p, basis) : null);
          }
          if (!drag.current || !scene) return;
          if (locked) {
            // Locked: the drag moves the board (in screen pixels), the map stays as it is.
            const vp = flow.getViewport();
            void flow.setViewport({
              x: vp.x + e.clientX - drag.current.x,
              y: vp.y + e.clientY - drag.current.y,
              zoom: vp.zoom,
            });
            drag.current = { x: e.clientX, y: e.clientY };
            return;
          }
          // The map follows the pointer however far the board is zoomed.
          const r = e.currentTarget.getBoundingClientRect();
          const k = r.width ? e.currentTarget.clientWidth / r.width : 1;
          scene.panBy((e.clientX - drag.current.x) * k, (e.clientY - drag.current.y) * k);
          drag.current = { x: e.clientX, y: e.clientY };
          setView((v) => v + 1);
        }}
        onPointerLeave={() => {
          setHover(null);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (tool === 'range') {
            rangeFrom.current = null;
            return;
          }
          // A click, not a drag: the ruler adds a point; otherwise a pin opens beside the map.
          const from = downAt.current;
          if (!scene || !from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5) return;
          const p = toMap(e.clientX, e.clientY);
          if (!p) return;
          if (tool === 'measure') {
            setPath((list) => [...list, measurePoint(p, basis)]);
            return;
          }
          const hit = scene.hit(p);
          const link = hit?.kind === 'pin' ? pinLink(hit) : null;
          if (!link) return;
          if (link.kind === 'page') {
            // A character or an encounter opens as a card beside the map; the other pages open in the app.
            const page = parsePagePath(link.path);
            if (page?.kind === 'characters')
              actions.addBeside(card.id, [
                {
                  kind: 'character',
                  character: page.id,
                  show: { spells: true, features: true, inventory: false },
                },
              ]);
            else if (page?.kind === 'encounters')
              actions.addBeside(card.id, [{ kind: 'encounter', encounter: page.id }]);
            else navigate(link.path);
            return;
          }
          const content: CardContent =
            link.kind === 'note'
              ? { kind: 'note', path: link.path }
              : link.kind === 'map'
                ? { kind: 'map', map: link.id }
                : { kind: 'entity', key: link.key };
          actions.addBeside(card.id, [content]);
        }}
      />
      {tool === 'look' && <PinHover scene={scene} host={host} campaignId={doc.campaign} />}
      <div className="flex items-center gap-2 border-t border-border px-2 py-1 text-xs">
        {tool === 'measure' ? (
          <>
            <span role="status" aria-label="Measured" className="min-w-0 flex-1 truncate">
              {total ?? (path.length === 0 ? 'Click to start measuring.' : 'Click the next point.')}
            </span>
            {path.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPath([]);
                }}
                className="text-link hover:underline"
              >
                Clear
              </button>
            )}
          </>
        ) : tool === 'range' ? (
          <>
            <select
              aria-label="Range shape"
              value={range.shape}
              onChange={(e) => {
                setRange({ ...range, shape: e.target.value as TemplateShape });
              }}
              className="rounded border border-border bg-surface px-1 py-0.5"
            >
              <option value="cone">Cone</option>
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="line">Line</option>
            </select>
            <input
              type="number"
              aria-label="Range in feet"
              min={5}
              step={5}
              value={range.feet}
              onChange={(e) => {
                setRange({ ...range, feet: Math.max(5, Number(e.target.value) || 5) });
              }}
              className="w-16 rounded border border-border bg-surface px-1 py-0.5"
            />
            <span className="flex-1 truncate text-muted">ft. Drag on the map from the origin.</span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <AppLink
          to={`/maps/${doc.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-link hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in the map maker
        </AppLink>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  Icon,
  pressed,
  disabled = false,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  disabled?: boolean;
  /** For tools that stay on (look, measure); absent for one-off actions (zoom). */
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1',
        pressed ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-sunken hover:text-text',
        'disabled:opacity-30',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
