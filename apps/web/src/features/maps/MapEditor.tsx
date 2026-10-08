import { Button, cn } from '@boh/ui';
import {
  ArrowLeft,
  Download,
  Expand,
  Maximize,
  PanelRight,
  Redo2,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath } from '../../app/data/entities';
import { runOnBoard } from '../../app/encounters/run';
import { useEncounters } from '../../app/encounters/store';
import { emptyHistory, record, redo as redoStep, undo as undoStep } from '../../app/history';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { useStamps } from '../../app/maps/assets';
import {
  distanceFeet,
  snapToCell,
  snapToCorner,
  templateOutline,
  type Point,
} from '../../app/maps/geometry';
import {
  addItem,
  findItem,
  itemId,
  mapKind,
  removeItem,
  updateItem,
  type MapDoc,
  type MapItem,
} from '../../app/maps/model';
import { pinLink } from '../../app/maps/pinLink';
import {
  drawRoute,
  MapScene,
  routeWidth,
  WALL_COLOR,
  type StrokeStyle,
} from '../../app/maps/scene';
import { useMapDoc, useMaps } from '../../app/maps/store';
import { measureLine } from '../../app/maps/travel';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { eraseStrokes, ROUTE_COLOR, routeStatus, simplify, type Drag } from './editorModel';
import { DeleteMap, NameInput } from './EditorParts';
import { MapPanels } from './MapPanels';
import {
  TOOLS_WITH_SETTINGS,
  toolsFor,
  type BrushSettings,
  type TemplateSettings,
  type Tool,
} from './tools';

/** One map, edited: the canvas, the tool bar and the side panels. */
export function MapEditor({ id }: { id: string }) {
  const { loaded, load } = useMaps();
  const doc = useMapDoc(id);
  const { loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const { loaded: encountersLoaded, load: loadEncounters } = useEncounters();
  const { loaded: stampsLoaded, load: loadStamps } = useStamps();
  usePageTitle(doc?.name ?? 'Map');
  useEffect(() => {
    if (!loaded) void load();
    if (!campaignsLoaded) void loadCampaigns();
    if (!encountersLoaded) void loadEncounters();
    if (!stampsLoaded) void loadStamps();
  }, [
    loaded,
    load,
    campaignsLoaded,
    loadCampaigns,
    encountersLoaded,
    loadEncounters,
    stampsLoaded,
    loadStamps,
  ]);
  // Pins link to the campaign's notes.
  const journal = useJournal();
  useEffect(() => {
    if (doc?.campaign && journal.campaignId !== doc.campaign) void journal.load(doc.campaign);
  }, [doc?.campaign, journal]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!doc) return <p className="p-8">This map does not exist (any more).</p>;
  return <Editor doc={doc} />;
}

function Editor({ doc }: { doc: MapDoc }) {
  const navigate = useAppNavigate();
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MapScene | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  /** Where the pointer went down (screen), to tell a click from a drag. */
  const downAt = useRef<Point | null>(null);
  const tools = toolsFor(mapKind(doc));
  // A tool the map's kind does not have (its kind was just changed) gives way to Select.
  if (tool !== 'select' && tool !== 'calibrate' && !tools.some((t) => t.id === tool))
    setTool('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [layerId, setLayerId] = useState(doc.layers.at(-2)?.id ?? doc.layers[0]?.id ?? '');
  const [stamp, setStamp] = useState<string | null>(null);
  const [stampAspect, setStampAspect] = useState(1);
  const [brush, setBrush] = useState<BrushSettings>({ color: '#111111', width: 6, opacity: 1 });
  const [terrain, setTerrain] = useState<BrushSettings>({
    color: '#5b8a2b',
    width: 120,
    opacity: 1,
    texture: 'grass',
  });
  const [eraser, setEraser] = useState(60);
  const [template, setTemplate] = useState<TemplateSettings>({
    shape: 'cone',
    feet: 15,
    color: '#dc2626',
  });
  const [snap, setSnap] = useState(true);
  const [viewing, setViewing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [wall, setWall] = useState<number[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadingPicture, setLoadingPicture] = useState(false);
  const [measure, setMeasure] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; mid: Point } | null>(null);
  const space = useRef(false);
  const steps = useRef(emptyHistory<MapDoc>());
  const [history, setHistory] = useState({ past: 0, future: 0 });
  const counted = () => {
    setHistory({ past: steps.current.past.length, future: steps.current.future.length });
  };
  const docId = doc.id;

  // The canvas, made once per map.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const s = new MapScene();
    s.onLoading = setLoadingPicture;
    let live = true;
    void s.init(el).then(() => {
      if (!live) return;
      const current = useMaps.getState().maps.find((m) => m.id === docId);
      if (current) s.setDoc(current);
      s.fit();
      setScene(s);
    });
    return () => {
      live = false;
      s.destroy();
    };
  }, [docId]);

  useEffect(() => {
    scene?.setDoc(doc);
    const found = selected ? findItem(doc, selected) : undefined;
    scene?.select(found?.item ?? null);
  }, [scene, doc, selected]);

  /** Changes the map as stored now, keeping the change for undo. */
  const commit = useCallback(
    (change: (d: MapDoc) => MapDoc) => {
      const s = useMaps.getState();
      const current = s.maps.find((m) => m.id === docId);
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      // Each change is a step of its own (a stroke, a move), never folded.
      steps.current = record(steps.current, current, Date.now(), 0);
      counted();
      s.save(next);
    },
    [docId],
  );
  const undo = useCallback(() => {
    const s = useMaps.getState();
    const current = s.maps.find((m) => m.id === docId);
    const done = current && undoStep(steps.current, current);
    if (!done) return;
    steps.current = done.history;
    counted();
    s.save(done.value);
  }, [docId]);
  const redo = useCallback(() => {
    const s = useMaps.getState();
    const current = s.maps.find((m) => m.id === docId);
    const done = current && redoStep(steps.current, current);
    if (!done) return;
    steps.current = done.history;
    counted();
    s.save(done.value);
  }, [docId]);

  const layer = doc.layers.find((l) => l.id === layerId) ?? doc.layers[0];
  const canDraw = layer !== undefined && !layer.locked;
  const grid = doc.grid;
  const snapCell = (p: Point) => (snap ? snapToCell(p, grid) : p);
  const snapPoint = (p: Point) => (snap ? snapToCorner(p, grid) : p);

  const place = (item: MapItem) => {
    if (!layer || layer.locked) return;
    commit((d) => addItem(d, layer.id, item));
    setSelected(item.id);
  };

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = host.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  /** Goes where a pin leads; false when it leads nowhere. */
  const followPin = (pin: Extract<MapItem, { kind: 'pin' }>, newTab: boolean): boolean => {
    const link = pinLink(pin);
    if (!link) return false;
    navigate(
      link.kind === 'map'
        ? `/maps/${link.id}`
        : link.kind === 'note'
          ? journalPath(link.path)
          : entityPath(link.key),
      { newTab },
    );
    return true;
  };

  const finishWall = () => {
    if (wall && wall.length >= 4 && layer) {
      const item: MapItem =
        tool === 'route'
          ? { kind: 'route', id: itemId(doc), points: wall, label: 'Route', color: ROUTE_COLOR }
          : { kind: 'wall', id: itemId(doc), points: wall };
      commit((d) => addItem(d, layer.id, item));
    }
    setWall(null);
    scene?.clearPreview();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scene) return;
    host.current?.setPointerCapture(e.pointerId);
    const screen = local(e);
    pointers.current.set(e.pointerId, screen);
    if (pointers.current.size === 2) {
      // Two fingers: pinch to zoom, whatever the tool.
      const [a, b] = [...pointers.current.values()];
      if (a && b)
        pinch.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
      drag.current = null;
      return;
    }
    const p = scene.toMap(screen.x, screen.y);
    const base = { start: p, screen, last: p };
    downAt.current = screen;
    // A pin's link: a click while viewing, Ctrl/Cmd+click while editing (in a new tab); with the
    // Pan tool, a click that does not pan (see onPointerUp).
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.button === 0 && (viewing || ctrl)) {
      const hit = scene.hit(p);
      if (hit?.kind === 'pin' && followPin(hit, ctrl)) return;
    }
    if (e.button === 1 || space.current || tool === 'pan' || viewing) {
      drag.current = { mode: 'pan', ...base };
      return;
    }
    if (e.button !== 0) return;
    switch (tool) {
      case 'select': {
        const hit = scene.hit(p);
        setSelected(hit?.id ?? null);
        drag.current = hit ? { mode: 'move', ...base, item: hit } : { mode: 'pan', ...base };
        return;
      }
      case 'stamp': {
        if (!stamp || !canDraw) return;
        const size = grid.size;
        const at = snapCell(p);
        place({
          kind: 'stamp',
          id: itemId(doc),
          stamp,
          x: at.x,
          y: at.y,
          w: stampAspect >= 1 ? size * stampAspect : size,
          h: stampAspect >= 1 ? size : size / stampAspect,
          rotation: 0,
        });
        return;
      }
      case 'pen':
      case 'terrain':
        if (!canDraw) return;
        drag.current = { mode: 'stroke', ...base, points: [p.x, p.y] };
        scene.previewStroke([p.x, p.y], strokeStyle());
        return;
      case 'eraser':
        if (!canDraw) return;
        drag.current = { mode: 'erase', ...base, points: [p.x, p.y] };
        previewEraser([p.x, p.y]);
        return;
      case 'wall': {
        if (!canDraw) return;
        const at = snapPoint(p);
        setWall((w) => [...(w ?? []), at.x, at.y]);
        return;
      }
      case 'route':
        // Stops are where they are clicked: a route follows roads and coasts, not the grid.
        if (!canDraw) return;
        setWall((w) => [...(w ?? []), p.x, p.y]);
        return;
      case 'text':
        place({
          kind: 'text',
          id: itemId(doc),
          x: p.x,
          y: p.y,
          text: 'Text',
          size: Math.round(grid.size * 0.6),
          color: '#111111',
        });
        setPanelOpen(true);
        return;
      case 'pin':
        place({ kind: 'pin', id: itemId(doc), x: p.x, y: p.y, label: 'Pin' });
        setPanelOpen(true);
        return;
      case 'measure':
        // A map with a real scale (a world map) measures from point to point, not cell to cell.
        drag.current = { mode: 'measure', ...base, start: doc.scale ? p : snapCell(p) };
        return;
      case 'template':
        drag.current = { mode: 'template', ...base, start: snap ? snapPoint(p) : p };
        return;
      case 'calibrate':
        drag.current = { mode: 'calibrate', ...base };
        return;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scene) return;
    const screen = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, screen);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      scene.panBy(mid.x - pinch.current.mid.x, mid.y - pinch.current.mid.y);
      scene.zoomAt(mid.x, mid.y, distance / pinch.current.distance);
      pinch.current = { distance, mid };
      return;
    }
    const p = scene.toMap(screen.x, screen.y);
    if (wall && tool === 'route')
      scene.drawPreview((g) => {
        drawRoute(g, [...wall, p.x, p.y], ROUTE_COLOR, routeWidth(doc));
      });
    if (wall && tool === 'wall') {
      const at = snapPoint(p);
      scene.drawPreview((g) => {
        g.moveTo(wall[0] ?? 0, wall[1] ?? 0);
        for (let i = 2; i + 1 < wall.length; i += 2) g.lineTo(wall[i] ?? 0, wall[i + 1] ?? 0);
        g.lineTo(at.x, at.y).stroke({
          color: WALL_COLOR,
          width: Math.max(6, grid.size * 0.14),
          alpha: 0.7,
          cap: 'round',
        });
      });
    }
    const d = drag.current;
    if (!d) return;
    switch (d.mode) {
      case 'pan':
        scene.panBy(screen.x - d.screen.x, screen.y - d.screen.y);
        d.screen = screen;
        return;
      case 'move': {
        if (!d.item) return;
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        const positioned = 'x' in d.item;
        const target = positioned ? snapMoved(d.item, dx, dy) : { x: dx, y: dy };
        scene.nudge(d.item.id, target.x, target.y);
        d.last = p;
        return;
      }
      case 'stroke':
      case 'erase': {
        // Every point the pointer went through since the last event, for smooth fast strokes
        // (where the browser gives them).
        const native = e.nativeEvent;
        const events = 'getCoalescedEvents' in native ? native.getCoalescedEvents() : [];
        const r = host.current?.getBoundingClientRect();
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const q = scene.toMap(ev.clientX - (r?.left ?? 0), ev.clientY - (r?.top ?? 0));
          d.points?.push(q.x, q.y);
        }
        if (d.mode === 'stroke') scene.previewStroke(d.points ?? [], strokeStyle());
        else previewEraser(d.points ?? []);
        return;
      }
      case 'measure': {
        const end = doc.scale ? p : snapCell(p);
        const line = doc.scale
          ? measureLine(d.start, end, doc.scale, doc.travel)
          : `${String(distanceFeet(d.start, end, grid))} ft`;
        setMeasure(line);
        scene.drawPreview(
          (g) => {
            g.moveTo(d.start.x, d.start.y)
              .lineTo(end.x, end.y)
              .stroke({ color: 0xfacc15, width: 4 / scene.zoom });
            g.circle(d.start.x, d.start.y, 6 / scene.zoom).fill({ color: 0xfacc15 });
          },
          // On the map, the distance; the times are in the bar above.
          { text: line.split(' · ')[0] ?? line, at: end },
        );
        return;
      }
      case 'template': {
        const angle = (Math.atan2(p.y - d.start.y, p.x - d.start.x) * 180) / Math.PI;
        const o = templateOutline(template.shape, d.start, template.feet, angle, grid);
        scene.drawPreview(
          (g) => {
            if (o.circle) g.circle(o.circle.x, o.circle.y, o.circle.r);
            if (o.polygon) g.poly(o.polygon.flatMap((q) => [q.x, q.y]));
            g.fill({ color: template.color, alpha: 0.25 }).stroke({
              color: template.color,
              width: 3,
            });
          },
          { text: `${String(template.feet)} ft ${template.shape}`, at: p },
        );
        d.last = p;
        return;
      }
      case 'calibrate':
        scene.drawPreview((g) => {
          g.rect(
            Math.min(d.start.x, p.x),
            Math.min(d.start.y, p.y),
            Math.abs(p.x - d.start.x),
            Math.abs(p.y - d.start.y),
          ).stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
        });
        d.last = p;
        return;
    }
  };

  /** How the brush in hand paints. */
  const strokeStyle = (): StrokeStyle => {
    const s = tool === 'terrain' ? terrain : brush;
    return {
      color: s.color,
      width: s.width,
      opacity: s.opacity,
      texture: tool === 'terrain' ? s.texture : undefined,
    };
  };

  /** The eraser's path, as a see-through band its width. */
  const previewEraser = (points: readonly number[]) => {
    scene?.drawPreview((g) => {
      g.moveTo(points[0] ?? 0, points[1] ?? 0);
      for (let i = 2; i + 1 < points.length; i += 2) g.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
      if (points.length === 2) g.lineTo((points[0] ?? 0) + 0.1, points[1] ?? 0);
      g.stroke({ color: 0xffffff, width: eraser, alpha: 0.45, cap: 'round', join: 'round' });
    });
  };

  /** Where a dragged item lands: its centre snapped to a cell for stamps and pins. */
  const snapMoved = (item: MapItem, dx: number, dy: number): Point => {
    if (!('x' in item)) return { x: dx, y: dy };
    const raw = { x: item.x + dx, y: item.y + dy };
    return item.kind === 'stamp' || item.kind === 'pin' ? snapCell(raw) : raw;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d || !scene) return;
    if (d.mode === 'pan' && tool === 'pan' && !viewing) {
      const up = local(e);
      const from = downAt.current;
      if (from && Math.hypot(up.x - from.x, up.y - from.y) < 5) {
        const hit = scene.hit(scene.toMap(up.x, up.y));
        if (hit?.kind === 'pin') followPin(hit, false);
      }
    }
    const p = d.last;
    switch (d.mode) {
      case 'move': {
        const item = d.item;
        if (!item) return;
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        commit((doc2) =>
          updateItem(doc2, item.id, (i) => {
            if ('x' in i) {
              const at = snapMoved(i, dx, dy);
              return { ...i, x: Math.round(at.x), y: Math.round(at.y) };
            }
            return { ...i, points: i.points.map((v, k) => Math.round(v + (k % 2 ? dy : dx))) };
          }),
        );
        return;
      }
      case 'stroke': {
        scene.clearPreview();
        const s = strokeStyle();
        const points = simplify(d.points ?? []);
        if (!layer) return;
        commit((doc2) =>
          addItem(doc2, layer.id, {
            kind: 'stroke',
            id: itemId(doc2),
            points,
            color: s.color,
            width: s.width,
            brush: tool === 'terrain' ? 'terrain' : 'pen',
            opacity: s.opacity,
            ...(s.texture ? { texture: s.texture } : {}),
          }),
        );
        return;
      }
      case 'erase': {
        scene.clearPreview();
        const path = d.points ?? [];
        commit((doc2) => eraseStrokes(doc2, path, eraser / 2));
        return;
      }
      case 'measure':
        // A measurement is not kept: it stays until the next click.
        return;
      case 'template': {
        scene.clearPreview();
        const angle =
          (Math.round((Math.atan2(p.y - d.start.y, p.x - d.start.x) * 180) / Math.PI) + 360) % 360;
        place({
          kind: 'template',
          id: itemId(doc),
          shape: template.shape,
          x: Math.round(d.start.x),
          y: Math.round(d.start.y),
          feet: template.feet,
          angle,
          color: template.color,
        });
        return;
      }
      case 'calibrate': {
        scene.clearPreview();
        const w = Math.abs(p.x - d.start.x);
        const h = Math.abs(p.y - d.start.y);
        const size = Math.round(Math.max(w, h));
        if (size < 8) return;
        const left = Math.min(d.start.x, p.x);
        const top = Math.min(d.start.y, p.y);
        commit((doc2) => ({
          ...doc2,
          grid: {
            ...doc2.grid,
            size,
            offsetX: Math.round(left % size),
            offsetY: Math.round(top % size),
          },
        }));
        setTool('select');
        return;
      }
      case 'pan':
        return;
    }
  };

  // Wheel: zoom at the pointer.
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

  // Keyboard: tools, undo, delete, rotate and resize the picked item.
  const selectedItem = selected ? findItem(doc, selected)?.item : undefined;
  // An item undone or removed is no longer picked (and does not come back picked on redo).
  if (selected && !selectedItem) setSelected(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === ' ') space.current = e.type === 'keydown';
      if (e.type !== 'keydown') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      // Alt combinations are the app's (tabs, modules).
      if (mod || e.altKey) return;
      if (e.key === 'Escape') {
        if (wall) finishWall();
        setSelected(null);
        setMeasure(null);
        scene?.clearPreview();
        if (viewing) setViewing(false);
        return;
      }
      if (e.key === 'Enter' && wall) {
        finishWall();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        commit((d) => removeItem(d, selected));
        setSelected(null);
        return;
      }
      if (selectedItem?.kind === 'stamp') {
        const turn = e.key === 'r' ? 15 : e.key === 'R' ? -15 : 0;
        const grow = e.key === ']' ? 1.1 : e.key === '[' ? 1 / 1.1 : 1;
        if (turn || grow !== 1) {
          commit((d) =>
            updateItem(d, selectedItem.id, (i) =>
              i.kind === 'stamp'
                ? {
                    ...i,
                    rotation: (i.rotation + turn + 360) % 360,
                    w: Math.round(i.w * grow),
                    h: Math.round(i.h * grow),
                  }
                : i,
            ),
          );
          return;
        }
      }
      const t = tools.find((x) => x.key === e.key.toLowerCase());
      if (t && !e.shiftKey) setTool(t.id);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  });

  const exportPng = async () => {
    if (!scene) return;
    setExporting(true);
    try {
      const blob = await scene.exportPng(grid.type !== 'none');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name || 'map'}.png`;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10_000);
    } finally {
      setExporting(false);
    }
  };

  const toggleView = () => {
    const next = !viewing;
    setViewing(next);
    setSelected(null);
    if (next) void shell.current?.requestFullscreen().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setViewing(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const encounter = useEncounters((s) => s.encounters.find((x) => x.id === doc.encounter));
  const cursor = useMemo(() => {
    if (viewing || tool === 'pan') return 'cursor-grab';
    if (tool === 'select') return 'cursor-default';
    return 'cursor-crosshair';
  }, [tool, viewing]);

  return (
    <div ref={shell} className="flex h-full flex-col bg-bg">
      {!viewing && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <AppLink
            to="/maps"
            aria-label="All maps"
            className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </AppLink>
          <NameInput
            name={doc.name}
            onRename={(name) => {
              commit((d) => ({ ...d, name }));
            }}
          />
          <Button variant="ghost" aria-label="Undo" disabled={history.past === 0} onClick={undo}>
            <Undo2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" aria-label="Redo" disabled={history.future === 0} onClick={redo}>
            <Redo2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            aria-label="Fit the map"
            onClick={() => {
              scene?.fit();
            }}
          >
            <Expand className="h-4 w-4" aria-hidden />
          </Button>
          {encounter && (
            <Button
              variant="ghost"
              onClick={() => {
                void runOnBoard(encounter).then(({ board, card }) => {
                  navigate(`/boards/${board}?focus=${card}`);
                });
              }}
            >
              <Swords className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Run {encounter.name}</span>
              <span className="sr-only sm:hidden">Run {encounter.name}</span>
            </Button>
          )}
          <Button variant="ghost" onClick={toggleView}>
            <Maximize className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Full page</span>
            <span className="sr-only sm:hidden">Full page</span>
          </Button>
          <Button variant="ghost" disabled={exporting || !scene} onClick={() => void exportPng()}>
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export PNG'}</span>
            <span className="sr-only sm:hidden">Export PNG</span>
          </Button>
          <DeleteMap doc={doc} />
          <Button
            variant="ghost"
            aria-label="Panels"
            aria-expanded={panelOpen}
            className="lg:hidden"
            onClick={() => {
              setPanelOpen(!panelOpen);
            }}
          >
            <PanelRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1">
        {!viewing && (
          <div
            role="toolbar"
            aria-label="Map tools"
            aria-orientation="vertical"
            className="flex flex-col gap-1 overflow-y-auto border-r border-border bg-surface p-1"
          >
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                aria-pressed={tool === t.id}
                title={`${t.label} (${t.key.toUpperCase()})`}
                onClick={() => {
                  if (wall) finishWall();
                  setTool(t.id);
                  setMeasure(null);
                  scene?.clearPreview();
                  if (TOOLS_WITH_SETTINGS.has(t.id)) setPanelOpen(true);
                }}
                className={cn(
                  'rounded-md p-2',
                  tool === t.id
                    ? 'bg-accent text-accent-fg'
                    : 'text-muted hover:bg-sunken hover:text-text',
                )}
              >
                <t.icon className="h-5 w-5" aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          <div
            ref={host}
            role="application"
            aria-label="Map canvas"
            aria-busy={loadingPicture}
            className={cn('absolute inset-0 touch-none overflow-hidden bg-sunken', cursor)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => {
              if (wall) finishWall();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
            }}
          />
          {loadingPicture && (
            <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-surface/90 px-3 py-1 text-sm text-muted shadow-card">
              Loading the picture…
            </p>
          )}
          {(wall !== null || measure !== null || tool === 'calibrate') && !viewing && (
            <p
              role="status"
              className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-3 py-1 text-sm shadow-card"
            >
              {tool === 'calibrate'
                ? 'Drag over one grid cell of the picture.'
                : wall && tool === 'route'
                  ? routeStatus(wall, doc)
                  : wall
                    ? 'Click to add corners; double-click or Enter to finish the wall.'
                    : `Distance: ${measure ?? ''}`}
            </p>
          )}
          {viewing && (
            <Button
              variant="ghost"
              className="absolute top-2 right-2 bg-surface/90 shadow-card"
              onClick={toggleView}
            >
              <X className="h-4 w-4" aria-hidden /> Leave full page
            </Button>
          )}
        </div>
        {!viewing && (
          <MapPanels
            doc={doc}
            open={panelOpen}
            onClose={() => {
              setPanelOpen(false);
            }}
            commit={commit}
            tool={tool}
            setTool={setTool}
            selected={selectedItem ?? null}
            onDeselect={() => {
              setSelected(null);
            }}
            layerId={layer?.id ?? ''}
            setLayerId={setLayerId}
            stamp={stamp}
            setStamp={(path, aspect) => {
              setStamp(path);
              setStampAspect(aspect);
              setTool('stamp');
            }}
            brush={brush}
            setBrush={setBrush}
            terrain={terrain}
            setTerrain={setTerrain}
            eraser={eraser}
            setEraser={setEraser}
            template={template}
            setTemplate={setTemplate}
            snap={snap}
            setSnap={setSnap}
          />
        )}
      </div>
    </div>
  );
}
