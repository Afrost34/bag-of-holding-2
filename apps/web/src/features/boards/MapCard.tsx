import { cn } from '@boh/ui';
import {
  ExternalLink,
  Hand,
  Maximize,
  Ruler,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import type { BoardCard, CardContent } from '../../app/boards/model';
import { measurePath, measurePoint } from '../../app/maps/measure';
import { PinHover } from '../../app/maps/PinHover';
import { pinLink } from '../../app/maps/pinLink';
import { MapScene } from '../../app/maps/scene';
import { useMaps } from '../../app/maps/store';
import { useBoardActions, useIsPlayersBoard } from './context';

interface Point {
  x: number;
  y: number;
}
type Tool = 'look' | 'measure';

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
          onClick={() => {
            zoom(1.25);
          }}
        />
        <ToolButton
          label="Zoom out"
          Icon={ZoomOut}
          onClick={() => {
            zoom(0.8);
          }}
        />
        <ToolButton
          label="Fit the map"
          Icon={Maximize}
          onClick={() => {
            scene?.fit();
            setView((v) => v + 1);
          }}
        />
      </div>
      <div
        ref={host}
        role="img"
        aria-label={`Map: ${doc.name}`}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-sunken',
          tool === 'measure' ? 'cursor-crosshair' : 'cursor-grab',
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (tool === 'measure' && !drag.current) {
            const p = toMap(e.clientX, e.clientY);
            setHover(p ? measurePoint(p, basis) : null);
          }
          if (!drag.current || !scene) return;
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
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
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
      onClick={onClick}
      className={cn(
        'rounded p-1',
        pressed ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-sunken hover:text-text',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
