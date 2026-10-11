import { Button, cn } from '@boh/ui';
import {
  ArrowLeft,
  Download,
  Expand,
  Maximize,
  Cast,
  Paintbrush,
  Eye,
  PanelRight,
  Redo2,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import { routeOverLand } from '../../app/maps/landRoute';
import { folderIndex } from '../../app/maps/packNames';
import { placePrefab, type Prefab } from '../../app/maps/prefabs';
import {
  defaultCaveWall,
  defaultDoor,
  defaultRoof,
  defaultRoomStyle,
  districtRoofs,
  defaultSlots,
} from '../../app/maps/packDefaults';
import { usePacks } from '../../app/maps/packs';
import { squaresOf } from '../../app/maps/packModel';
import { useStored, useStoredNumber } from './useStored';
import { isPackTexture, type TerrainRef } from '../../app/maps/terrain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { useCampaigns } from '../../app/campaigns/store';
import { entityPath } from '../../app/data/entities';
import { sendToPlayers } from '../../app/boards/player';
import { runOnBoard } from '../../app/encounters/run';
import { useEncounters } from '../../app/encounters/store';
import { emptyHistory, record, redo as redoStep, undo as undoStep } from '../../app/history';
import { journalPath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { useStamps } from '../../app/maps/assets';
import { placeFootprint, useBuildings } from '../../app/maps/buildings';
import {
  addItems,
  DEFAULT_DISTRICT,
  eraseBuildings,
  generateTown,
  makeBuilding,
  makeDistrict,
  rotatePoints,
  type DistrictSettings,
} from '../../app/maps/cityDoc';
import {
  addMirrored,
  constrainAngle,
  itemsInBox,
  itemsWithIds,
  pasteItems,
  MIRRORS,
  moveItems,
  nearestVertex,
  removeItems,
  translateItem,
  type Mirror,
} from '../../app/maps/arrange';
import { encodeHeights, heightAt, heightsOf, paintHeights } from '../../app/maps/elevation';
import { generateArchipelago } from '../../app/maps/islandgen';
import { defaultLabelText, targetLine } from '../../app/maps/labels';
import { doorOnWall, generateCave, roomOutline } from '../../app/maps/rooms';
import { archetypeById } from '../../app/maps/structure/archetypes';
import { isPortalPicture, portalOnWalls } from '../../app/maps/portal';
import {
  makeScatter,
  mixSettings,
  singlePiece,
  type DressSettings,
} from '../../app/maps/scatterDoc';
import { recipeById } from '../../app/maps/dress/recipes';
import { DEFAULT_DRESS, settingsFor } from '../../app/maps/dress/settings';
import {
  addStructure,
  mergeFootprint,
  newBuildingSpec,
  touchesFootprint,
} from '../../app/maps/structure/structureDoc';
import { makeKit } from '../../app/maps/kits/kitDoc';
import { boxFrame, hullOutline } from '../../app/maps/structure/shipplan';
import { generateOf } from './tools';
import { useArtPrefs } from '../../app/maps/artPrefs';
import { bakeMap } from '../../app/maps/render';
import { PATH_STYLES } from '../../app/maps/shapes';
import { bounds, nearestOnPolyline, splinePoints } from '../../app/maps/spline';
import { TERRAINS } from '../../app/maps/terrain';
import { metersPerPixel, metersToPx, stampUnit } from '../../app/maps/units';
import { dragBox, FREE_SHAPE, presetOutline, type ShapeChoice } from '../../app/maps/outline';
import { snapToCell, snapToCorner, templateOutline, type Point } from '../../app/maps/geometry';
import {
  addFog,
  artHash,
  findItem,
  hasArt,
  isDrawable,
  itemId,
  rectPoints,
  setActiveVariant,
  stepVariant,
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
  packTexture,
  pathPictureWidth,
} from '../../app/maps/scene';
import { useMapDoc, useMaps } from '../../app/maps/store';
import { measurePath } from '../../app/maps/measure';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import {
  dedupePoints,
  eraseStrokes,
  dropLastPoint,
  insertVertex,
  isClosedItem,
  isPointItem,
  minPoints,
  nearestHandle,
  pushRecent,
  pushSlot,
  DEFAULT_SLOTS,
  type HotStamp,
  removeVertex,
  ROUTE_COLOR,
  routeStatus,
  simplify,
  smoothOf,
  snapRiverEnd,
  applyPoints,
  handlePoints,
  type Drag,
  selectedName,
  MIN_STAMP_SCALE,
  MAX_STAMP_SCALE,
} from './editorModel';
import { DeleteMap, NameInput } from './EditorParts';
import { ExportDialog } from './ExportDialog';
import { BottomBar } from './BottomBar';
import { ToolRail } from './ToolRail';
import { Hotbar } from './Hotbar';
import { MapSearch } from './MapSearch';
import { MapPanels } from './MapPanels';
import { PinHover } from '../../app/maps/PinHover';
import {
  DEFAULT_KIT,
  TOOL_HINTS,
  TOOLS_WITH_SETTINGS,
  toolsFor,
  type AreaSettings,
  type BrushSettings,
  type BuildingSettings,
  type KitSettings,
  type ElevationBrush,
  type FogSettings,
  type LightSettings,
  type IslandRequest,
  type PathSettings,
  type RoomSettings,
  type MapMode,
  type TemplateSettings,
  type Tool,
} from './tools';

/** One map, edited: the canvas, the tool bar and the side panels. */
/** Copied items, kept across maps (Ctrl+C here, Ctrl+V on another map). */
let clipboard: MapItem[] = [];

export function MapEditor({ id, mode }: { id: string; mode: MapMode }) {
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
  return <Editor key={mode} doc={doc} mode={mode} />;
}

function Editor({ doc, mode }: { doc: MapDoc; mode: MapMode }) {
  const navigate = useAppNavigate();
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MapScene | null>(null);
  const creator = mode === 'creator';
  const [tool, setToolNow] = useState<Tool>('select');
  const packList = usePacks();
  /** The shape the next area drawn is cut out of, instead of becoming a shape of its own. */
  const [holeOf, setHoleOf] = useState<string | null>(null);
  /** Another tool drops a hole that was being drawn. */
  const setTool = (next: Tool, restore = true) => {
    setHoleOf(null);
    setToolNow(next);
    // The Stamp and Portal tools each keep the picture picked in them.
    if (restore && (next === 'stamp' || next === 'door')) {
      const kept = picks[next];
      if (kept) {
        setStamp(kept.ref);
        setStampAspect(kept.aspect);
        setStampSquares(kept.squares);
      } else if (next === 'door') {
        const door = defaultDoor(packList.entries);
        if (door) {
          const squares = squaresOf(door.path);
          setStamp(door.ref);
          setStampAspect(squares ? squares.w / squares.h : 1);
          setStampSquares(squares);
        }
      }
    }
  };
  /** The picture each of the Stamp and Portal tools last had. */
  const [picks, setPicks] = useState<
    Partial<Record<Tool, { ref: string; aspect: number; squares: { w: number; h: number } | null }>>
  >({});
  /** Where the pointer went down (screen), to tell a click from a drag. */
  const downAt = useRef<Point | null>(null);
  const tools = toolsFor(mode);
  // A tool the map's kind does not have (its kind was just changed) gives way to Select.
  if (tool !== 'select' && tool !== 'calibrate' && !tools.some((t) => t.id === tool))
    setTool('select');
  const [selected, setSelected] = useState<string | null>(null);
  const drawable = doc.layers.filter(isDrawable);
  const [layerId, setLayerId] = useState(drawable.at(-2)?.id ?? drawable[0]?.id ?? '');
  /** The control point of the picked shape under the pointer (-1: none): Delete removes it. */
  const hoverHandle = useRef(-1);
  const [stamp, setStamp] = useState<string | null>(null);
  const [stampAspect, setStampAspect] = useState(1);
  const [stampSquares, setStampSquares] = useState<{ w: number; h: number } | null>(null);
  // How the next stamp is turned, mirrored and sized: wheel, A, right-click and Alt+wheel (as in Dungeondraft).
  const [stampTurn, setStampTurn] = useState({ rotation: 0, flip: false, scale: 1 });
  const fine = useRef(false);
  const [brush, setBrush] = useStored<BrushSettings>('brush', {
    color: '#111111',
    width: 6,
    opacity: 1,
  });
  // No texture yet means the first slot (a pack's grass once packs are imported, else the drawn one).
  const [terrainState, setTerrain] = useStored<BrushSettings>('terrain', {
    color: '#5b8a2b',
    width: 120,
    opacity: 1,
  });
  const [eraser, setEraser] = useStoredNumber('eraser', 60);
  const [template, setTemplate] = useStored<TemplateSettings>('template', {
    shape: 'cone',
    feet: 15,
    color: '#dc2626',
  });
  const [light, setLight] = useStored<LightSettings>('light', {
    squares: 6,
    color: '#ffd9a0',
    intensity: 0.9,
    shadows: true,
  });
  const [fog, setFog] = useStored<FogSettings>('fog', { mode: 'hide', shape: 'rect' });
  const [scatter, setScatter] = useState<DressSettings>(DEFAULT_DRESS);
  const drawnArt = useArtPrefs((s) => s.drawnArt);
  /** A recipe's settings for this map, from the packs (or its glyphs when there are none). */
  const recipeSettings = (id: string): DressSettings | null => {
    const recipe = recipeById(id);
    return recipe
      ? settingsFor(
          recipe,
          packList.entries,
          { unit: stampUnit(doc), drawn: drawnArt },
          { scale: scatter.scale },
        )
      : null;
  };
  /** How each area tool draws: clicked corners, or dragged out as a rectangle, circle… (kept per tool). */
  const [draws, setDraws] = useStored<Partial<Record<Tool, ShapeChoice>>>('draws', {
    room: { kind: 'rect', sides: 6 },
    building: { kind: 'rect', sides: 6 },
  });
  const draw: ShapeChoice = draws[tool] ?? FREE_SHAPE;
  const setDraw = (c: ShapeChoice) => {
    setDraws((all) => ({ ...all, [tool]: c }));
  };
  /** Whether a press with this tool begins dragging out a preset shape. */
  const dragsShape = (t: Tool) =>
    (draws[t]?.kind ?? FREE_SHAPE.kind) !== 'free' && (t !== 'scatter' || scatter.mode === 'area');
  const [district, setDistrict] = useStored<DistrictSettings>('district', DEFAULT_DISTRICT);
  const [kitSet, setKitSet] = useStored<KitSettings>('kit', DEFAULT_KIT);
  const [buildingState, setBuildingSet] = useStored<BuildingSettings>('building', {
    roof: 'tiles',
    color: '#b5543a',
    libraryId: null,
  });
  // Until a room style is chosen it is the packs' cobblestone floor and stone wall strip.
  const [roomPick, setRoomPick] = useStored<{ picked: boolean }>('room-picked', { picked: false });
  const roomPicked = roomPick.picked;
  const setRoomPicked = (picked: boolean) => {
    setRoomPick({ picked });
  };
  const [roomState, setRoomState] = useStored<RoomSettings>('room', {
    floor: 'stone',
    wallStyle: 'stone',
    wall: 12,
    smooth: 0,
    doorKind: 'door',
  });
  /**
   * The item the tool is for, when one is picked: changing the tool's settings then changes that
   * item too (draw a shape, then pick another material), not only the next one drawn.
   */
  const pickedFor = <K extends MapItem['kind']>(
    forTool: Tool,
    kind: K,
  ): Extract<MapItem, { kind: K }> | null => {
    const item = selected && group.length === 0 ? findItem(doc, selected)?.item : undefined;
    return tool === forTool && item?.kind === kind ? (item as Extract<MapItem, { kind: K }>) : null;
  };
  const setRoomSet = (r: RoomSettings) => {
    setRoomPicked(true);
    setRoomState(r);
    const room = pickedFor('room', 'room');
    if (room)
      commit((d) =>
        updateItem(d, room.id, (i) => {
          if (i.kind !== 'room') return i;
          const { wallTexture: _w, ...rest } = i;
          return {
            ...rest,
            smooth: r.smooth,
            floor: r.floor,
            wall: r.wall,
            wallStyle: r.wallStyle,
            ...(r.wallTexture ? { wallTexture: r.wallTexture } : {}),
          };
        }),
      );
  };
  const [areaState, setAreaState] = useStored<AreaSettings>('area', {
    texture: 'grass',
    edge: 'shore',
    smooth: 0.8,
    opacity: 1,
  });
  // Until a shape texture is picked it is the first terrain slot.
  const [areaPick, setAreaPick] = useStored<{ picked: boolean }>('area-picked', { picked: false });
  const areaPicked = areaPick.picked;
  const setAreaPicked = (picked: boolean) => {
    setAreaPick({ picked });
  };
  const setArea = (a: AreaSettings) => {
    if (a.texture !== areaState.texture) setAreaPicked(true);
    setAreaState(a);
    const shape = pickedFor('area', 'shape');
    if (shape) {
      const base = TERRAINS.find((t) => t.id === a.texture)?.base;
      commit((d) =>
        updateItem(d, shape.id, (i) =>
          i.kind === 'shape'
            ? {
                ...i,
                smooth: a.smooth,
                texture: a.texture,
                opacity: a.opacity,
                edge: a.edge,
                ...(base ? { color: base } : {}),
              }
            : i,
        ),
      );
    }
  };
  const setPathLive = (p: PathSettings) => {
    setPathSet(p);
    // Its picture starts loading now, so its width is known when the path is drawn.
    if (p.texture) packTexture(p.texture);
    const path = pickedFor('path', 'path');
    if (path) {
      const color = PATH_STYLES.find((x) => x.id === p.style)?.color ?? path.color;
      const width =
        p.texture && p.fit !== false ? (pathPictureWidth(p.texture, doc) ?? p.width) : p.width;
      commit((d) =>
        updateItem(d, path.id, (i) => {
          if (i.kind !== 'path') return i;
          const { texture: _t, taper: _a, start: _s, end: _e, loop: _l, ...rest } = i;
          return {
            ...rest,
            style: p.style,
            width,
            smooth: p.smooth,
            color,
            ...(p.style === 'river' ? { taper: p.taper } : {}),
            ...(p.start !== 'hard' ? { start: p.start } : {}),
            ...(p.end !== 'hard' ? { end: p.end } : {}),
            ...(p.loop ? { loop: true } : {}),
            ...(p.texture ? { texture: p.texture } : {}),
          };
        }),
      );
    }
  };
  const setBuildingLive = (b: BuildingSettings) => {
    setBuildingSet(b);
    const building = pickedFor('building', 'building');
    if (building)
      commit((d) =>
        updateItem(d, building.id, (i) => {
          if (i.kind !== 'building') return i;
          const { roofTexture: _r, ...rest } = i;
          return {
            ...rest,
            roof: b.roof,
            color: b.color,
            ...(b.roofTexture ? { roofTexture: b.roofTexture } : {}),
          };
        }),
      );
  };
  const [pathSet, setPathSet] = useStored<PathSettings>('path', {
    style: 'road',
    width: 24,
    smooth: 0.6,
    taper: true,
    start: 'hard',
    end: 'hard',
    loop: false,
  });
  /** The variant whose layers show faintly under the map (comparing floors or versions). */
  const [compare, setCompare] = useState<string | undefined>(undefined);
  const [snap, setSnapState] = useState(() => {
    try {
      return localStorage.getItem('boh.map.snap') !== 'off';
    } catch {
      return true;
    }
  });
  const setSnap = (on: boolean) => {
    setSnapState(on);
    try {
      localStorage.setItem('boh.map.snap', on ? 'on' : 'off');
    } catch {
      /* a private window: the choice lasts until the page closes */
    }
  };
  /** Stamps used lately, kept on this device. */
  const [hot, setHotState] = useState<HotStamp[]>(() => {
    try {
      const raw = localStorage.getItem('boh.map.hotbar');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (x): x is HotStamp =>
              typeof x === 'object' &&
              x !== null &&
              typeof (x as HotStamp).ref === 'string' &&
              typeof (x as HotStamp).aspect === 'number',
          )
        : [];
    } catch {
      return [];
    }
  });
  const rememberStamp = (item: HotStamp) => {
    const next = pushRecent(hot, item);
    setHotState(next);
    try {
      localStorage.setItem('boh.map.hotbar', JSON.stringify(next));
    } catch {
      /* a private window: the bar lasts until the page closes */
    }
  };
  /** The terrain textures used last: Dungeondraft's slots, kept on this device. */
  const [slotsChosen, setSlotsState] = useState<string[] | null>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('boh.map.slots') ?? 'null');
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') && parsed.length > 0)
        return parsed.slice(0, 8);
    } catch {
      /* none kept yet */
    }
    return null;
  });
  // Until slots are chosen they are the packs' grass, dirt, rock, sand… (or the drawn ones).
  const packSlots = useMemo(() => defaultSlots(packList.entries), [packList.entries]);
  const slots = slotsChosen ?? (packSlots.length > 0 ? packSlots : DEFAULT_SLOTS);
  const packRoom = useMemo(() => defaultRoomStyle(packList.entries), [packList.entries]);
  // A new building is roofed with a tiled roof of the packs until another texture is picked.
  const packRoof = useMemo(() => defaultRoof(packList.entries), [packList.entries]);
  const buildingSet: BuildingSettings =
    buildingState.roofTexture || !packRoof
      ? buildingState
      : { ...buildingState, roofTexture: packRoof };
  const roomSet: RoomSettings = roomPicked
    ? roomState
    : {
        ...roomState,
        ...(packRoom.floor ? { floor: packRoom.floor as TerrainRef } : {}),
        ...(packRoom.wall ? { wallTexture: packRoom.wall } : {}),
      };
  const area: AreaSettings =
    areaPicked || !isPackTexture(slots[0] ?? '')
      ? areaState
      : { ...areaState, texture: slots[0] as TerrainRef };
  const terrain: BrushSettings = terrainState.texture
    ? terrainState
    : {
        ...terrainState,
        texture: (slots[0] ?? 'grass') as TerrainRef,
        color: isPackTexture(slots[0] ?? '') ? '#9a958d' : '#5b8a2b',
      };
  const pickTerrain = (b: BrushSettings) => {
    setTerrain(b);
    if (b.texture && b.texture !== terrain.texture) {
      const next = pushSlot(slots, b.texture);
      setSlotsState(next);
      try {
        localStorage.setItem('boh.map.slots', JSON.stringify(next));
      } catch {
        /* a private window: the slots last until the page closes */
      }
    }
  };
  const [zoom, setZoom] = useState(1);
  const [cursorSquare, setCursorSquare] = useState<{ col: number; row: number } | null>(null);
  const [mirror, setMirror] = useState<Mirror>('off');
  const [elev, setElev] = useStored<ElevationBrush>('elevation', {
    mode: 'raise',
    radius: 160,
    strength: 0.5,
  });
  /** The heights being painted, before the stroke is kept. */
  const elevWork = useRef<Uint8Array | null>(null);
  /** Items picked besides `selected` (Shift+click). */
  const [group, setGroup] = useState<string[]>([]);
  const [viewing, setViewing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [wall, setWall] = useState<number[] | null>(null);
  /** The export dialog is open. */
  const [exporting, setExporting] = useState(false);
  const [loadingPicture, setLoadingPicture] = useState(false);
  /** The path being measured: a point per click, until Escape or another tool. */
  const [measured, setMeasured] = useState<Point[]>([]);
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
    s.hideAnnotations = creator;
    s.useRender = !creator;
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
  }, [docId, creator]);

  useEffect(() => {
    scene?.setCompare(compare);
    scene?.setDoc(doc);
    const found = selected ? findItem(doc, selected) : undefined;
    const more = itemsWithIds(doc, group);
    if (found && more.length > 0) scene?.selectMany([found.item, ...more]);
    else scene?.select(found?.item ?? null);
  }, [scene, doc, selected, group, compare]);

  // A few seconds after the art last changed, the Creator makes the flat picture other devices
  // (a phone without the packs) show instead of drawing it.
  const hash = artHash(doc);
  const baked = doc.render?.hash;
  const artful = hasArt(doc);
  useEffect(() => {
    if (!creator || !scene || !artful || baked === hash) return;
    let live = true;
    const timer = setTimeout(() => {
      const current = useMaps.getState().maps.find((x) => x.id === docId);
      if (!current || artHash(current) !== hash) return;
      void bakeMap(current)
        .then((render) => {
          const latest = useMaps.getState().maps.find((x) => x.id === docId);
          if (live && latest && artHash(latest) === hash)
            useMaps.getState().save({ ...latest, render });
        })
        .catch((error: unknown) => {
          console.warn('Could not make the flat picture of the map', error);
        });
    }, 4000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [creator, scene, artful, baked, hash, docId]);

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

  const layer = drawable.find((l) => l.id === layerId) ?? drawable[0];
  const canDraw = layer !== undefined && !layer.locked;
  const grid = doc.grid;
  const snapCell = (p: Point) => (snap ? snapToCell(p, grid) : p);
  const snapPoint = (p: Point) => (snap ? snapToCorner(p, grid) : p);
  // A map with a real scale (a world map) measures from point to point, not cell to cell.
  const measureAt = (p: Point) => (doc.scale ? p : snapCell(p));
  const measureBasis = { scale: doc.scale, travel: doc.travel, grid };
  const measure = measurePath(measured, measureBasis);
  /** Draws the path, with the leg to the pointer when given. */
  const drawMeasured = (points: readonly Point[]) => {
    const line = measurePath(points, measureBasis);
    // On the map, the distance; the times are in the bar above.
    scene?.drawMeasure(points, line ? (line.split(' · ')[0] ?? line) : null);
  };

  /** An item added to the layer, with its mirrored copies when a mirror is on. */
  const add = (d: MapDoc, layerId: string, item: MapItem): MapDoc =>
    addMirrored(d, layerId, item, mirror);

  /**
   * A point as the pointer placed it: with Snap on it goes to another corner nearby or to the grid
   * (Alt places it freely); Shift holds it to 15° steps instead of the grid.
   */
  const pt = (raw: Point, shift: boolean, free = false): [number, number] => {
    let q = raw;
    if (shift && wall && wall.length >= 2)
      q = constrainAngle({ x: wall[wall.length - 2] ?? 0, y: wall[wall.length - 1] ?? 0 }, q);
    if (snap && !free) {
      const near = nearestVertex(doc, q, 10 / (scene?.zoom ?? 1));
      if (near) q = near;
      else if (!shift) q = snapToCorner(q, grid);
    }
    return [q.x, q.y];
  };

  const place = (item: MapItem) => {
    if (!layer || layer.locked) return;
    commit((d) => add(d, layer.id, item));
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
          : link.kind === 'page'
            ? link.path
            : entityPath(link.key),
      { newTab },
    );
    return true;
  };

  const finishWall = () => {
    finishFrom(wall);
  };
  /** Ends the outline being drawn (clicked corners, or a preset shape's) with the current tool. */
  const finishFrom = (wall: number[] | null) => {
    if (wall && tool === 'fog') {
      if (wall.length >= 6) commit((d) => addFog(d, wall, fog.mode === 'reveal'));
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'area' && holeOf) {
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 6)
        commit((d) =>
          updateItem(d, holeOf, (i) =>
            i.kind === 'shape' || i.kind === 'district'
              ? { ...i, holes: [...(i.holes ?? []), points] }
              : i,
          ),
        );
      setHoleOf(null);
      setWall(null);
      scene?.clearPreview();
      setSelected(holeOf);
      return;
    }
    if (wall && tool === 'area') {
      const points = dedupePoints(wall);
      if (points.length >= 6 && layer) {
        const base = TERRAINS.find((t) => t.id === area.texture)?.base ?? '#5b8a2b';
        const areaId = itemId(doc);
        commit((d) =>
          add(d, layer.id, {
            kind: 'shape',
            id: areaId,
            points: points.map(Math.round),
            smooth: area.smooth,
            texture: area.texture,
            color: base,
            opacity: area.opacity,
            edge: area.edge,
          }),
        );
        setSelected(areaId);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'room') {
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 6 && layer) {
        const id = itemId(doc);
        commit((d) =>
          add(d, layer.id, {
            kind: 'room',
            id,
            points,
            smooth: roomSet.smooth,
            floor: roomSet.floor,
            wall: roomSet.wall,
            wallStyle: roomSet.wallStyle,
            ...(roomSet.wallTexture ? { wallTexture: roomSet.wallTexture } : {}),
          }),
        );
        setSelected(id);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'district') {
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 6 && layer) {
        const id = itemId(doc);
        commit((d) =>
          add(
            d,
            layer.id,
            makeDistrict(
              id,
              {
                ...district,
                roofTextures:
                  district.roofTextures ?? districtRoofs(packList.entries, district.style),
              },
              points,
              Math.floor(Math.random() * 1e9),
              0.25,
              1 / metersPerPixel(d),
            ),
          ),
        );
        setSelected(id);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'building' && buildingSet.whole) {
      // A whole building: a new one, or the picked one grown by what was drawn.
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 6) {
        const settings = generateOf(buildingSet);
        const ship = archetypeById(settings.archetype).layout === 'ship';
        const picked = selectedItem?.kind === 'structure' && !ship ? selectedItem : null;
        if (picked && touchesFootprint(picked, points, doc.grid.size))
          commit((d) => mergeFootprint(d, picked.group, points));
        else {
          const id = itemId(doc);
          // A ship fills the box drawn, its bow along the longer side.
          const box = bounds(points);
          const heading = box.x1 - box.x0 >= box.y1 - box.y0 ? 90 : 0;
          const footprint = ship ? hullOutline(boxFrame(box, heading)) : points;
          commit((d) => {
            const spec = newBuildingSpec(
              { ...settings, heading },
              packList.entries,
              Math.floor(Math.random() * 2 ** 31),
              // FA walls are about a third of a square thick.
              Math.max(8, Math.round(d.grid.size * 0.32)),
              { unit: stampUnit(d), drawn: drawnArt },
            );
            return addStructure(d, { spec, points: footprint }, id).doc;
          });
          setSelected(id);
        }
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'building') {
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 6 && layer) {
        const id = itemId(doc);
        commit((d) =>
          add(d, layer.id, {
            ...makeBuilding(id, points, buildingSet.roof, buildingSet.color),
            ...(buildingSet.roofTexture ? { roofTexture: buildingSet.roofTexture } : {}),
          }),
        );
        setSelected(id);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'scatter') {
      const points = dedupePoints(wall).map(Math.round);
      const enough = scatter.mode === 'area' ? 6 : 4;
      if (points.length >= enough && layer) {
        const id = itemId(doc);
        commit((d) =>
          add(d, layer.id, makeScatter(id, scatter, { points }, Math.floor(Math.random() * 1e9))),
        );
        setSelected(id);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'kit') {
      // A walkway, pipe run or colonnade along the line clicked.
      const points = dedupePoints(wall).map(Math.round);
      if (points.length >= 4 && layer) {
        const id = itemId(doc);
        commit((d) =>
          add(
            d,
            layer.id,
            makeKit(id, kitSet.kit, points, packList.entries, {
              drawn: drawnArt,
              loop: kitSet.loop,
            }),
          ),
        );
        setSelected(id);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    if (wall && tool === 'path') {
      let points = dedupePoints(wall).map(Math.round);
      if (points.length >= 4 && layer) {
        const color = PATH_STYLES.find((p) => p.id === pathSet.style)?.color ?? '#d9c79e';
        const joined =
          pathSet.style === 'river' ? snapRiverEnd(doc, points, 30 / (scene?.zoom ?? 1)) : null;
        if (joined) points = joined.points;
        // A road between the points clicked takes the way a road builder would over the hills.
        if (pathSet.followLand && pathSet.style !== 'river' && doc.elevation)
          points = routeOverLand(doc.elevation, points);
        const pathId = itemId(doc);
        const pathWidth =
          pathSet.texture && pathSet.fit !== false
            ? (pathPictureWidth(pathSet.texture, doc) ?? pathSet.width)
            : pathSet.width;
        commit((d) =>
          add(d, layer.id, {
            kind: 'path',
            id: pathId,
            points,
            smooth: pathSet.smooth,
            style: pathSet.style,
            width: pathWidth,
            color,
            ...(pathSet.style === 'river' ? { taper: pathSet.taper } : {}),
            ...(joined?.into ? { into: joined.into } : {}),
            ...(pathSet.start !== 'hard' ? { start: pathSet.start } : {}),
            ...(pathSet.end !== 'hard' ? { end: pathSet.end } : {}),
            ...(pathSet.loop ? { loop: true } : {}),
            ...(pathSet.texture ? { texture: pathSet.texture } : {}),
          }),
        );
        setSelected(pathId);
      }
      setWall(null);
      scene?.clearPreview();
      return;
    }
    // A double click places its point twice: one is enough.
    const placed = wall ? dedupePoints(wall) : null;
    if (wall && placed && placed.length >= 4 && layer) {
      const item: MapItem =
        tool === 'route'
          ? { kind: 'route', id: itemId(doc), points: placed, label: 'Route', color: ROUTE_COLOR }
          : {
              kind: 'wall',
              id: itemId(doc),
              points: placed,
              ...(roomSet.wallTexture ? { texture: roomSet.wallTexture } : {}),
            };
      commit((d) => add(d, layer.id, item));
    }
    setWall(null);
    scene?.clearPreview();
  };

  /**
   * Dress a picked shape or room, or along a picked path (tied: it follows when that moves).
   */
  const scatterOn = (target: MapItem) => {
    if (
      !layer ||
      layer.locked ||
      (target.kind !== 'shape' && target.kind !== 'path' && target.kind !== 'room')
    )
      return;
    const id = itemId(doc);
    // A shape or room wants an area dressing, a path a line one: the current recipe if it fits,
    // else a sensible one (a forest, a storeroom, trees beside a road).
    const wanted = target.kind === 'path' ? 'along' : 'area';
    const fallback = recipeSettings(
      target.kind === 'path' ? 'roadside' : target.kind === 'room' ? 'storage' : 'forest',
    );
    const settings: DressSettings = scatter.mode === wanted || !fallback ? scatter : fallback;
    const where =
      target.kind === 'path'
        ? { points: [], follow: target.id }
        : { points: [], within: target.id };
    commit((d) =>
      add(d, layer.id, makeScatter(id, settings, where, Math.floor(Math.random() * 1e9))),
    );
    setSelected(id);
  };

  /**
   * A dungeon filling the view, kept live (a one-floor structure: rooms, corridors, doors and
   * furniture from its kind, rolled again or baked like a building; ADR 0015).
   */
  const generateDungeonHere = (rooms: number, archetypeId: string) => {
    const el = host.current;
    if (!scene || !el || !layer || layer.locked) return;
    const tl = scene.toMap(0, 0);
    const br = scene.toMap(el.clientWidth, el.clientHeight);
    const c = grid.size;
    const x0 = Math.max(0, tl.x);
    const y0 = Math.max(0, tl.y);
    const x1 = Math.min(doc.width, br.x);
    const y1 = Math.min(doc.height, br.y);
    const margin = Math.min(x1 - x0, y1 - y0) * 0.06;
    // Whole cells, at least 8 by 8.
    const gx0 = Math.ceil((x0 + margin) / c) * c;
    const gy0 = Math.ceil((y0 + margin) / c) * c;
    const gx1 = Math.max(gx0 + 8 * c, Math.floor((x1 - margin) / c) * c);
    const gy1 = Math.max(gy0 + 8 * c, Math.floor((y1 - margin) / c) * c);
    const points = [gx0, gy0, gx1, gy0, gx1, gy1, gx0, gy1];
    const archetype = archetypeById(archetypeId);
    const id = itemId(doc);
    commit((d) => {
      const spec = newBuildingSpec(
        {
          ...generateOf(buildingSet),
          archetype: archetype.id,
          style: archetype.style,
          rooms,
          upper: 0,
          cellar: false,
          windows: false,
          crooked: 0,
        },
        packList.entries,
        Math.floor(Math.random() * 2 ** 31),
        Math.max(8, Math.round(d.grid.size * 0.32)),
        { unit: stampUnit(d), drawn: drawnArt },
      );
      return addStructure(d, { spec, points }, id).doc;
    });
    setSelected(id);
  };

  /** A cave in the middle of the view. */
  const generateCaveHere = () => {
    // A cave's rim is a cave cliff strip of the packs, unless a wall style was picked.
    const caveWall = roomPicked
      ? roomSet.wallTexture
      : (defaultCaveWall(packList.entries) ?? roomSet.wallTexture);
    const el = host.current;
    if (!scene || !el || !layer || layer.locked) return;
    const c = scene.toMap(el.clientWidth / 2, el.clientHeight / 2);
    const radius = (Math.min(el.clientWidth, el.clientHeight) / scene.zoom) * 0.17;
    const points = generateCave(c.x, c.y, radius, Math.floor(Math.random() * 1e9)).map(Math.round);
    commit((d) =>
      add(d, layer.id, {
        kind: 'room',
        id: itemId(d),
        points,
        smooth: 0.8,
        floor: roomSet.floor === 'stone' ? 'dirt' : roomSet.floor,
        wall: roomSet.wall,
        wallStyle: 'cave',
        ...(caveWall ? { wallTexture: caveWall } : {}),
      }),
    );
  };

  /** A walled town with a market quarter, in the middle of the view. */
  const generateTownHere = () => {
    const el = host.current;
    if (!scene || !el || !layer || layer.locked) return;
    const c = scene.toMap(el.clientWidth / 2, el.clientHeight / 2);
    // A town of about 300 m across (the map's own size if it is smaller): real, whatever the map.
    const radius = Math.min(
      metersToPx(doc, 150) * district.scale,
      Math.min(doc.width, doc.height) * 0.4,
    );
    const seed = Math.floor(Math.random() * 1e9);
    const first = itemId(doc);
    commit((d) =>
      addItems(
        d,
        layer.id,
        generateTown(
          d,
          c,
          radius,
          seed,
          district.scale,
          (taken) => {
            let n = 0;
            while (taken.includes(`town${String(n)}-${first}`)) n++;
            return `town${String(n)}-${first}`;
          },
          (style) => districtRoofs(packList.entries, style),
        ),
      ),
    );
  };

  /** A saved prefab goes down in the middle of the view, picked as a group. */
  const placePrefabHere = (prefab: Prefab) => {
    const el = host.current;
    if (!scene || !el || !layer || layer.locked) return;
    const at = scene.toMap(el.clientWidth / 2, el.clientHeight / 2);
    // A varying prefab picks other shapes of its pictures each time.
    const variety = prefab.vary
      ? { index: folderIndex(packList.entries), rand: Math.random }
      : undefined;
    const placed = placePrefab(doc, layer.id, prefab, snapCell(at), variety);
    commit(() => placed.doc);
    setSelected(placed.ids[0] ?? null);
    setGroup(placed.ids.slice(1));
  };

  /** The Scatter tool takes a set of pack pictures as its mix (trees, rocks, a whole folder). */
  const scatterWithPictures = (refs: string[]) => {
    if (refs.length === 0) return;
    setScatter(mixSettings(refs, scatter, stampUnit(doc)));
    setTool('scatter');
    setPanelOpen(true);
  };

  /** A room furnished: a dressing of furniture tied to it, so it follows when the room changes. */
  const furnishRoom = (roomId: string, recipeId: string) => {
    const settings = recipeSettings(recipeId);
    if (!settings || !layer || layer.locked) return;
    const id = itemId(doc);
    commit((d) =>
      add(
        d,
        layer.id,
        makeScatter(id, settings, { points: [], within: roomId }, Math.floor(Math.random() * 1e9)),
      ),
    );
    setSelected(id);
  };

  /** Drops the points placed so far without making anything. */
  const cancelWall = () => {
    setHoleOf(null);
    setWall(null);
    scene?.clearPreview();
  };

  /** Random islands in the middle of the view, with the terrain tool's look. */
  const generate = (request: IslandRequest) => {
    const el = host.current;
    if (!scene || !el || !layer || layer.locked) return;
    const c = scene.toMap(el.clientWidth / 2, el.clientHeight / 2);
    const base = TERRAINS.find((t) => t.id === area.texture)?.base ?? '#5b8a2b';
    const islands = generateArchipelago({
      x: c.x,
      y: c.y,
      radius: Math.min(doc.width, doc.height) * request.size,
      seed: request.seed,
      ruggedness: request.ruggedness,
      elongation: request.elongation,
      count: request.count,
    });
    commit((d) =>
      islands.reduce(
        (acc, points) =>
          add(acc, layer.id, {
            kind: 'shape',
            id: itemId(acc),
            points,
            smooth: Math.max(area.smooth, 0.7),
            texture: area.texture,
            color: base,
            opacity: area.opacity,
            edge: area.edge,
          }),
        d,
      ),
    );
  };

  /** The whole map covered with the chosen terrain, under everything else on the layer. */
  const fillMap = (texture: TerrainRef = area.texture) => {
    if (!layer || layer.locked) return;
    const base = TERRAINS.find((t) => t.id === texture)?.base ?? '#9a958d';
    commit((d) => {
      const shape: MapItem = {
        kind: 'shape',
        id: itemId(d),
        points: [0, 0, d.width, 0, d.width, d.height, 0, d.height],
        smooth: 0,
        texture,
        color: base,
        opacity: 1,
        edge: 'none',
      };
      return {
        ...d,
        layers: d.layers.map((l) => (l.id === layer.id ? { ...l, items: [shape, ...l.items] } : l)),
      };
    });
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
    // A picked shape or path shows a handle on each control point: drag it, or right-click to
    // remove it.
    if (
      creator &&
      tool === 'select' &&
      (e.button === 0 || e.button === 2) &&
      isPointItem(selectedItem)
    ) {
      const handles = handlePoints(selectedItem, doc.grid.size);
      const index = nearestHandle(handles, p, 10 / scene.zoom);
      if (index >= 0) {
        if (e.button === 2) {
          const points = removeVertex(handles, index, minPoints(selectedItem));
          commit((d) => applyPoints(d, selectedItem.id, points));
        } else drag.current = { mode: 'vertex', ...base, index, points: [...handles] };
        return;
      }
    }
    if (e.button === 1 || space.current || tool === 'pan' || viewing) {
      drag.current = { mode: 'pan', ...base };
      return;
    }
    if (e.button !== 0) return;
    switch (tool) {
      case 'select': {
        const found = scene.hit(p);
        // The Viewer moves what it placed (pins, routes), never the map's art.
        const hit =
          found && !creator && found.kind !== 'pin' && found.kind !== 'route' ? null : found;
        if (e.shiftKey && creator) {
          // Shift+click adds an item to the pick, or takes it out.
          if (hit) {
            const ids = selected ? [selected, ...group] : [];
            const next = ids.includes(hit.id) ? ids.filter((x) => x !== hit.id) : [...ids, hit.id];
            setSelected(next[0] ?? null);
            setGroup(next.slice(1));
          }
          return;
        }
        // Dragging one of several picked items moves them all.
        const inGroup = hit && group.length > 0 && (hit.id === selected || group.includes(hit.id));
        if (!inGroup) {
          setSelected(hit?.id ?? null);
          setGroup([]);
        }
        // Dragging over empty ground with the mouse picks what it goes over; a finger pans.
        if (hit) drag.current = { mode: 'move', ...base, item: hit };
        else if (creator && e.pointerType === 'mouse') drag.current = { mode: 'box', ...base };
        else drag.current = { mode: 'pan', ...base };
        return;
      }
      case 'stamp': {
        if (!stamp || !canDraw) return;
        // True to the map's scale: one square of the pack's art is `size` pixels here.
        const size = stampUnit(doc);
        // A door or a window of a pack goes onto the nearest wall, turned along it.
        const onWall = isPortalPicture(stamp) ? portalOnWalls(doc, p, grid.size * 0.75) : null;
        const at = onWall ?? snapCell(p);
        place({
          kind: 'stamp',
          id: itemId(doc),
          stamp,
          x: at.x,
          y: at.y,
          w:
            (stampSquares ? stampSquares.w * size : stampAspect >= 1 ? size * stampAspect : size) *
            stampTurn.scale,
          h:
            (stampSquares ? stampSquares.h * size : stampAspect >= 1 ? size : size / stampAspect) *
            stampTurn.scale,
          rotation: onWall ? Math.round((onWall.angle * 180) / Math.PI) : stampTurn.rotation,
          ...(stampTurn.flip ? { flipX: true } : {}),
        });
        return;
      }
      case 'pen':
      case 'terrain':
        if (!canDraw) return;
        // Alt erases with the same brush, as in Dungeondraft.
        if (e.altKey) {
          drag.current = { mode: 'erase', ...base, points: [p.x, p.y] };
          previewEraser([p.x, p.y]);
          return;
        }
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
        if (!canDraw) return;
        setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        return;
      case 'text': {
        // Clicked on a river, road or coast: the label runs along it.
        const on = scene.hit(p);
        const target = on && (on.kind === 'path' || on.kind === 'shape') ? on : null;
        place({
          kind: 'text',
          id: itemId(doc),
          x: target ? p.x : snapCell(p).x,
          y: target ? p.y : snapCell(p).y,
          text: target ? defaultLabelText(target) : 'Text',
          size: Math.round(
            target
              ? Math.max(grid.size * 0.5, Math.min(doc.width, doc.height) / 32)
              : Math.max(grid.size * 0.6, Math.min(doc.width, doc.height) / 45),
          ),
          color: '#111111',
          ...(target
            ? {
                follow: target.id,
                along: nearestOnPolyline(targetLine(doc, target.id) ?? [], p).t,
              }
            : {}),
        });
        setPanelOpen(true);
        return;
      }

      case 'light':
        if (!canDraw) return;
        place({
          kind: 'light',
          id: itemId(doc),
          x: Math.round(snapCell(p).x),
          y: Math.round(snapCell(p).y),
          range: Math.round(light.squares * grid.size),
          color: light.color,
          intensity: light.intensity,
          shadows: light.shadows,
        });
        setPanelOpen(true);
        return;
      case 'pin':
        place({ kind: 'pin', id: itemId(doc), x: snapCell(p).x, y: snapCell(p).y, label: 'Pin' });
        setPanelOpen(true);
        return;
      case 'measure':
        // The point is added when the button comes up without moving (see onPointerUp).
        drag.current = { mode: 'measure', ...base, start: measureAt(p) };
        return;
      case 'template':
        drag.current = { mode: 'template', ...base, start: snap ? snapPoint(p) : p };
        return;
      case 'elevation': {
        const e = doc.elevation;
        if (!e) return;
        const work = heightsOf(e);
        elevWork.current = work;
        // Flatten pulls towards the height where the stroke began.
        const target = heightAt(e, work, p.x, p.y);
        paintHeights(work, e, p, elev.radius, elev.strength, elev.mode, target);
        scene.previewElevation(e, work);
        drag.current = { mode: 'elevation', ...base, index: target };
        return;
      }
      case 'room':
        if (!canDraw) return;
        if (dragsShape('room')) drag.current = { mode: 'preset', ...base, start: snapPoint(p) };
        else setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        return;
      case 'door': {
        // A door or window picked from a pack goes onto the nearest wall, turned along it.
        if (stamp && isPortalPicture(stamp)) {
          if (!canDraw) return;
          const onWall = portalOnWalls(doc, p, grid.size * 0.75);
          if (!onWall) return;
          place({
            kind: 'stamp',
            id: itemId(doc),
            stamp,
            x: onWall.x,
            y: onWall.y,
            w: (stampSquares ? stampSquares.w : 1) * stampUnit(doc),
            h: (stampSquares ? stampSquares.h : 1) * stampUnit(doc),
            rotation: Math.round((onWall.angle * 180) / Math.PI),
          });
          return;
        }
        // A door goes on the nearest wall of any room within reach; one already there is removed.
        let best: { id: string; x: number; y: number; angle: number; reach: number } | null = null;
        for (const l of doc.layers)
          for (const it of l.items) {
            if (it.kind !== 'room') continue;
            const hit = doorOnWall(roomOutline(it.points, it.smooth), p, 16 / scene.zoom);
            if (!hit) continue;
            const reach = Math.hypot(hit.x - p.x, hit.y - p.y);
            if (!best || reach < best.reach) best = { id: it.id, ...hit, reach };
          }
        if (!best) return;
        const target = best;
        commit((d) =>
          updateItem(d, target.id, (i) => {
            if (i.kind !== 'room') return i;
            const doors = i.doors ?? [];
            const near = doors.findIndex(
              (x) => Math.hypot(x.x - target.x, x.y - target.y) < i.wall * 3,
            );
            const next =
              near >= 0
                ? doors.filter((_, k) => k !== near)
                : [
                    ...doors,
                    { x: target.x, y: target.y, angle: target.angle, kind: roomSet.doorKind },
                  ];
            if (next.length > 0) return { ...i, doors: next };
            const { doors: _d, ...rest } = i;
            return rest;
          }),
        );
        return;
      }
      case 'building': {
        if (!canDraw) return;
        const entry = buildingSet.libraryId
          ? useBuildings.getState().entries.find((e) => e.id === buildingSet.libraryId)
          : undefined;
        if (entry) {
          const id = itemId(doc);
          place(makeBuilding(id, placeFootprint(entry, p), entry.roof, entry.color, entry.name));
          return;
        }
        if (dragsShape('building')) drag.current = { mode: 'preset', ...base, start: snapPoint(p) };
        else setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        return;
      }
      case 'scatter':
        if (scatter.single) {
          // One random piece of the set where it is clicked, as a stamp of its own.
          if (!canDraw) return;
          const at = e.altKey ? p : snapPoint(p);
          commit((d) => {
            const piece = singlePiece(d, scatter, at, itemId(d), Math.floor(Math.random() * 1e9));
            return piece ? add(d, layer.id, piece) : d;
          });
          return;
        }
        if (canDraw && dragsShape('scatter'))
          drag.current = { mode: 'preset', ...base, start: snapPoint(p) };
        else if (canDraw) setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        return;
      case 'area':
      case 'path':
      case 'kit':
      case 'district':
        if (canDraw && dragsShape(tool))
          drag.current = { mode: 'preset', ...base, start: snapPoint(p) };
        else if (canDraw) setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        return;
      case 'fog':
        if (fog.shape === 'polygon') setWall((w) => [...(w ?? []), ...pt(p, e.shiftKey, e.altKey)]);
        else drag.current = { mode: 'fog', ...base };
        return;
      case 'calibrate':
        drag.current = { mode: 'calibrate', ...base };
        return;
    }
  };

  // Whether a stamp is being placed: the wheel, A and right-click then work on it.
  const placingRef = useRef(false);
  const placing = creator && tool === 'stamp' && stamp !== null && !viewing;
  useEffect(() => {
    placingRef.current = placing;
  });

  /** The stamp about to be placed follows the pointer, turned, mirrored and sized as it will be. */
  const lastPointer = useRef<Point | null>(null);
  const updateGhost = (p: Point | null) => {
    if (!scene) return;
    if (!p || !placing || !stamp) {
      scene.hideGhost();
      return;
    }
    const size = stampUnit(doc);
    const onWall = isPortalPicture(stamp) ? portalOnWalls(doc, p, grid.size * 0.75) : null;
    const at = onWall ?? snapCell(p);
    const w =
      (stampSquares ? stampSquares.w * size : stampAspect >= 1 ? size * stampAspect : size) *
      stampTurn.scale;
    const h =
      (stampSquares ? stampSquares.h * size : stampAspect >= 1 ? size : size / stampAspect) *
      stampTurn.scale;
    scene.showGhost(
      stamp,
      at,
      w,
      h,
      onWall ? Math.round((onWall.angle * 180) / Math.PI) : stampTurn.rotation,
      stampTurn.flip,
    );
  };
  useEffect(() => {
    updateGhost(lastPointer.current);
    // The ghost follows the pointer and these settings; the rest is read when it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampTurn, stamp, tool, scene, viewing]);

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
    lastPointer.current = p;
    updateGhost(p);
    const col = Math.floor((p.x - grid.offsetX) / grid.size) + 1;
    const row = Math.floor((p.y - grid.offsetY) / grid.size) + 1;
    setCursorSquare((c) => (c?.col === col && c.row === row ? c : { col, row }));
    setZoom(scene.zoom);
    hoverHandle.current =
      creator && tool === 'select' && isPointItem(selectedItem)
        ? nearestHandle(handlePoints(selectedItem, doc.grid.size), p, 10 / scene.zoom)
        : -1;
    if (tool === 'measure' && measured.length > 0 && !drag.current)
      drawMeasured([...measured, measureAt(p)]);
    if (wall && tool === 'route')
      scene.drawPreview((g) => {
        drawRoute(g, [...wall, p.x, p.y], ROUTE_COLOR, routeWidth(doc));
      });
    if (
      wall &&
      (tool === 'area' ||
        tool === 'path' ||
        tool === 'kit' ||
        tool === 'scatter' ||
        tool === 'district' ||
        tool === 'building' ||
        tool === 'room')
    ) {
      const closed =
        tool === 'kit'
          ? kitSet.loop
          : tool !== 'path' && (tool !== 'scatter' || scatter.mode === 'area');
      const control = [...wall, ...pt(p, e.shiftKey, e.altKey)];
      const line = splinePoints(
        control,
        closed,
        tool === 'area'
          ? area.smooth
          : tool === 'scatter'
            ? 0.7
            : tool === 'district'
              ? 0.25
              : tool === 'building'
                ? 0
                : tool === 'room'
                  ? roomSet.smooth
                  : tool === 'kit'
                    ? 0.5
                    : pathSet.smooth,
      );
      scene.drawPreview((g) => {
        if (closed) g.poly(line).fill({ color: 0x3b82f6, alpha: 0.18 });
        g.poly(line, closed).stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
        for (let i = 0; i + 1 < wall.length; i += 2)
          g.circle(wall[i] ?? 0, wall[i + 1] ?? 0, 4 / scene.zoom)
            .fill({ color: 0xffffff })
            .stroke({ color: 0x3b82f6, width: 1.5 / scene.zoom });
      });
    }
    if (wall && tool === 'fog')
      scene.drawPreview((g) => {
        g.poly([...wall, p.x, p.y]).fill({
          color: fog.mode === 'reveal' ? 0xffffff : 0x111111,
          alpha: 0.35,
        });
        g.poly([...wall, p.x, p.y], false).stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
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
      case 'box':
        d.last = p;
        scene.drawPreview((g) => {
          g.rect(
            Math.min(d.start.x, p.x),
            Math.min(d.start.y, p.y),
            Math.abs(p.x - d.start.x),
            Math.abs(p.y - d.start.y),
          )
            .fill({ color: 0x3b82f6, alpha: 0.12 })
            .stroke({ color: 0x3b82f6, width: 1.5 / scene.zoom });
        });
        return;
      case 'move': {
        if (!d.item) return;
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (group.length > 0 && (d.item.id === selected || group.includes(d.item.id))) {
          scene.nudgeBy(itemsWithIds(doc, [selected ?? '', ...group]), dx, dy);
          d.last = p;
          return;
        }
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
      case 'measure':
        return;
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
      case 'elevation': {
        const e = doc.elevation;
        const work = elevWork.current;
        if (!e || !work) return;
        // Dabs all along the way since the last event, so a fast drag leaves no gaps.
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(p.x - d.last.x, p.y - d.last.y) / (elev.radius / 4)),
        );
        for (let k = 1; k <= steps; k++)
          paintHeights(
            work,
            e,
            {
              x: d.last.x + ((p.x - d.last.x) * k) / steps,
              y: d.last.y + ((p.y - d.last.y) * k) / steps,
            },
            elev.radius,
            elev.strength / 2,
            elev.mode,
            d.index,
          );
        scene.previewElevation(e, work);
        d.last = p;
        return;
      }
      case 'preset': {
        const outline = presetOutline(
          draw,
          dragBox(d.start, snapPoint(p), e.shiftKey, e.altKey),
          1,
        );
        scene.drawPreview((g) => {
          if (outline) {
            g.poly(outline)
              .fill({ color: 0x3b82f6, alpha: 0.18 })
              .stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
          }
        });
        d.last = p;
        return;
      }
      case 'vertex': {
        const item = selectedItem;
        if (!d.points || d.index === undefined || !isPointItem(item)) return;
        d.points[d.index * 2] = p.x;
        d.points[d.index * 2 + 1] = p.y;
        const closed = isClosedItem(item);
        const line = splinePoints(d.points, closed, smoothOf(item));
        scene.drawPreview((g) => {
          g.poly(line, closed).stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
          g.circle(p.x, p.y, 6 / scene.zoom).fill({ color: 0x3b82f6 });
        });
        d.last = p;
        return;
      }
      case 'fog':
        scene.drawPreview((g) => {
          g.rect(
            Math.min(d.start.x, p.x),
            Math.min(d.start.y, p.y),
            Math.abs(p.x - d.start.x),
            Math.abs(p.y - d.start.y),
          )
            .fill({ color: fog.mode === 'reveal' ? 0xffffff : 0x111111, alpha: 0.35 })
            .stroke({ color: 0x3b82f6, width: 2 / scene.zoom });
        });
        d.last = p;
        return;
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
      tile: tool === 'terrain' ? s.tile : undefined,
      soft: tool === 'terrain' ? s.soft : undefined,
      border: tool === 'terrain' ? s.border : undefined,
      water: tool === 'terrain' ? s.water : undefined,
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
        if (group.length > 0 && (item.id === selected || group.includes(item.id))) {
          const ids = [selected ?? '', ...group];
          commit((doc2) => moveItems(doc2, ids, Math.round(dx), Math.round(dy)));
          return;
        }
        commit((doc2) =>
          updateItem(doc2, item.id, (i) => {
            if ('x' in i) {
              const at = snapMoved(i, dx, dy);
              return { ...i, x: Math.round(at.x), y: Math.round(at.y) };
            }
            return translateItem(i, Math.round(dx), Math.round(dy));
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
          add(doc2, layer.id, {
            kind: 'stroke',
            id: itemId(doc2),
            points,
            color: s.color,
            width: s.width,
            brush: tool === 'terrain' ? 'terrain' : 'pen',
            opacity: s.opacity,
            ...(s.texture ? { texture: s.texture } : {}),
            ...(s.tile && s.tile !== 1 ? { tile: s.tile } : {}),
            ...(s.soft ? { soft: s.soft } : {}),
            ...(s.border ? { border: true } : {}),
            ...(s.water ? { water: s.water } : {}),
          }),
        );
        return;
      }
      case 'erase': {
        scene.clearPreview();
        const path = d.points ?? [];
        commit((doc2) => eraseBuildings(eraseStrokes(doc2, path, eraser / 2), path, eraser / 2));
        return;
      }
      case 'measure': {
        // A click adds a point to the path; a measurement is never kept on the map.
        const up = local(e);
        if (Math.hypot(up.x - d.screen.x, up.y - d.screen.y) >= 5) return;
        const next = [...measured, d.start];
        setMeasured(next);
        drawMeasured(next);
        return;
      }
      case 'elevation': {
        const work = elevWork.current;
        elevWork.current = null;
        if (!work) return;
        commit((d2) =>
          d2.elevation ? { ...d2, elevation: { ...d2.elevation, data: encodeHeights(work) } } : d2,
        );
        return;
      }
      case 'preset': {
        scene.clearPreview();
        const outline = presetOutline(draw, dragBox(d.start, snapPoint(p), e.shiftKey, e.altKey));
        if (outline && layer) finishFrom(outline.map(Math.round));
        return;
      }
      case 'vertex': {
        scene.clearPreview();
        const item = selectedItem;
        if (!d.points || d.index === undefined || !isPointItem(item)) return;
        const points = d.points.map(Math.round);
        commit((doc2) => applyPoints(doc2, item.id, points));
        return;
      }
      case 'box': {
        scene.clearPreview();
        // A click that did not drag picks nothing (and drops the pick).
        const moved =
          Math.abs(p.x - d.start.x) > 4 / scene.zoom || Math.abs(p.y - d.start.y) > 4 / scene.zoom;
        const ids = moved
          ? itemsInBox(doc, {
              x0: Math.min(d.start.x, p.x),
              y0: Math.min(d.start.y, p.y),
              x1: Math.max(d.start.x, p.x),
              y1: Math.max(d.start.y, p.y),
            })
          : [];
        setSelected(ids[0] ?? null);
        setGroup(ids.slice(1));
        return;
      }
      case 'template':
        // A range to measure, never kept on the map: the preview stays until the next one.
        return;
      case 'fog': {
        scene.clearPreview();
        if (Math.abs(p.x - d.start.x) < 6 || Math.abs(p.y - d.start.y) < 6) return;
        const points = rectPoints(
          Math.round(Math.min(d.start.x, p.x)),
          Math.round(Math.min(d.start.y, p.y)),
          Math.round(Math.max(d.start.x, p.x)),
          Math.round(Math.max(d.start.y, p.y)),
        );
        commit((d2) => addFog(d2, points, fog.mode === 'reveal'));
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
      // Placing a stamp: Ctrl+wheel turns it (15°, 5° with Z held), Alt+wheel resizes it; the wheel zooms.
      if (placingRef.current && (e.ctrlKey || e.metaKey || e.altKey)) {
        const dir = e.deltaY < 0 ? 1 : -1;
        if (e.altKey)
          setStampTurn((t) => ({
            ...t,
            scale: Math.min(
              MAX_STAMP_SCALE,
              Math.max(
                MIN_STAMP_SCALE,
                Math.round(t.scale * (dir > 0 ? 1.1 : 1 / 1.1) * 1000) / 1000,
              ),
            ),
          }));
        else
          setStampTurn((t) => ({
            ...t,
            rotation: (((t.rotation + dir * (fine.current ? 5 : 15)) % 360) + 360) % 360,
          }));
        return;
      }
      const r = el.getBoundingClientRect();
      scene.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      setZoom(scene.zoom);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [scene]);

  // Keyboard: tools, undo, delete, rotate and resize the picked item.
  const selectedItem = selected ? findItem(doc, selected)?.item : undefined;
  // Items undone or removed drop out of the pick.
  const liveGroup = group.filter((id) => findItem(doc, id));
  // An item undone or removed is no longer picked (and does not come back picked on redo).
  if (selected && !selectedItem) setSelected(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === ' ') space.current = e.type === 'keydown';
      if (e.key === 'z' || e.key === 'Z') fine.current = e.type === 'keydown';
      if (e.type !== 'keydown') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (creator && mod && ['c', 'x', 'v', 'd'].includes(e.key.toLowerCase())) {
        const key = e.key.toLowerCase();
        const ids = [selected, ...group].filter((id): id is string => !!id);
        if (key === 'c' || key === 'x' || key === 'd') {
          if (ids.length === 0) return;
          e.preventDefault();
          clipboard = itemsWithIds(doc, ids);
          if (key === 'x') {
            commit((d) => removeItems(d, ids));
            setSelected(null);
            setGroup([]);
            return;
          }
          if (key === 'c') return;
        } else if (clipboard.length === 0) return;
        e.preventDefault();
        const home = findItem(doc, clipboard[0]?.id ?? '')?.layer.id ?? layer?.id ?? '';
        const target = drawable.some((l) => l.id === home) ? home : (layer?.id ?? '');
        const pasted = pasteItems(doc, target, clipboard, grid.size, grid.size);
        commit(() => pasted.doc);
        clipboard = itemsWithIds(pasted.doc, pasted.ids);
        setSelected(pasted.ids[0] ?? null);
        setGroup(pasted.ids.slice(1));
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
        if (
          wall &&
          (tool === 'area' ||
            tool === 'path' ||
            tool === 'kit' ||
            tool === 'scatter' ||
            tool === 'district' ||
            tool === 'building' ||
            tool === 'room' ||
            tool === 'fog')
        )
          cancelWall();
        else if (wall) finishWall();
        setSelected(null);
        setGroup([]);
        setMeasured([]);
        scene?.clearPreview();
        if (viewing) setViewing(false);
        // Escape always ends up on Select.
        setTool('select');
        return;
      }
      if (e.key === 'Enter' && wall) {
        finishWall();
        return;
      }
      // Backspace while placing points takes the last one back.
      if (e.key === 'Backspace' && wall && wall.length >= 2) {
        e.preventDefault();
        setWall(dropLastPoint(wall));
        scene?.clearPreview();
        return;
      }
      // Delete over a control point of the picked shape removes that point, not the shape.
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        creator &&
        tool === 'select' &&
        isPointItem(selectedItem) &&
        hoverHandle.current >= 0
      ) {
        const points = removeVertex(
          handlePoints(selectedItem, doc.grid.size),
          hoverHandle.current,
          minPoints(selectedItem),
        );
        hoverHandle.current = -1;
        commit((d) => applyPoints(d, selectedItem.id, points));
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        const ids = [selected, ...group];
        commit((d) => removeItems(d, ids));
        setSelected(null);
        setGroup([]);
        return;
      }
      // [ and ] size the brush and the eraser, as in Dungeondraft.
      if (!selectedItem && (e.key === '[' || e.key === ']')) {
        const grow = e.key === ']' ? 1.15 : 1 / 1.15;
        if (placingRef.current)
          setStampTurn((t) => ({
            ...t,
            scale: Math.min(
              MAX_STAMP_SCALE,
              Math.max(MIN_STAMP_SCALE, Math.round(t.scale * grow * 1000) / 1000),
            ),
          }));
        else if (tool === 'terrain')
          setTerrain((t) => ({
            ...t,
            width: Math.min(400, Math.max(20, Math.round(t.width * grow))),
          }));
        else if (tool === 'pen')
          setBrush((b) => ({ ...b, width: Math.min(40, Math.max(1, Math.round(b.width * grow))) }));
        else if (tool === 'eraser')
          setEraser((v) => Math.min(400, Math.max(10, Math.round(v * grow))));
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
      if (selectedItem?.kind === 'building' && (e.key === 'r' || e.key === 'R')) {
        const turn = e.key === 'r' ? 15 : -15;
        commit((d) =>
          updateItem(d, selectedItem.id, (i) =>
            i.kind === 'building' ? { ...i, points: rotatePoints(i.points, turn) } : i,
          ),
        );
        return;
      }
      // 1–9 pick the stamps of the hotbar.
      if (creator && /^[1-9]$/.test(e.key) && !e.shiftKey) {
        const item = hot[Number(e.key) - 1];
        if (item) {
          rememberStamp(item);
          setStamp(item.ref);
          setStampAspect(item.aspect);
          setStampSquares(item.squares ?? null);
          setTool('stamp');
          return;
        }
      }
      // Page Up and Page Down step through the variants (floors, versions).
      if ((e.key === 'PageUp' || e.key === 'PageDown') && (doc.variants?.length ?? 0) > 1) {
        e.preventDefault();
        commit((d) => stepVariant(d, e.key === 'PageDown' ? 1 : -1));
        return;
      }
      // Shift+1…9 pick the layer to draw on (Dungeondraft's layer keys).
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (e.shiftKey && digit) {
        const target = drawable[Number(digit[1]) - 1];
        if (target) setLayerId(target.id);
        return;
      }
      if (placingRef.current && (e.key === 'a' || e.key === 'A')) {
        setStampTurn((t) => ({ ...t, flip: !t.flip }));
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        commit((d) => ({ ...d, grid: { ...d.grid, visible: !d.grid.visible } }));
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        setSnap(!snap);
        return;
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
          {!creator && (
            <MapSearch
              doc={doc}
              onPick={(hit) => {
                scene?.centerOn(hit.at);
                if (hit.kind === 'pin') setSelected(hit.id);
              }}
            />
          )}
          {creator && (
            <select
              aria-label="Mirror"
              title="Draw on both sides of the middle of the map"
              value={mirror}
              onChange={(e) => {
                setMirror(e.target.value as Mirror);
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            >
              {MIRRORS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          {(doc.variants?.length ?? 0) > 0 && (
            <select
              aria-label="Variant"
              value={doc.activeVariant ?? ''}
              onChange={(e) => {
                commit((d) => setActiveVariant(d, e.target.value || undefined));
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="">Layers as set</option>
              {doc.variants?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          {!creator && encounter && (
            <Button
              variant="ghost"
              onClick={() => {
                void runOnBoard(encounter).then(({ board, card }) => {
                  navigate(`/boards/${board}?focus=${card}`);
                });
              }}
            >
              <Swords className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">Run {encounter.name}</span>
              <span className="sr-only 2xl:hidden">Run {encounter.name}</span>
            </Button>
          )}
          {!creator && (
            <Button
              variant="ghost"
              onClick={() => {
                void sendToPlayers([{ kind: 'map', map: doc.id }], doc.campaign);
              }}
            >
              <Cast className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">Show to players</span>
              <span className="sr-only 2xl:hidden">Show to players</span>
            </Button>
          )}
          {creator ? (
            <AppLink
              to={`/maps/${doc.id}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-text"
            >
              <Eye className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">View map</span>
              <span className="sr-only 2xl:hidden">View map</span>
            </AppLink>
          ) : (
            <AppLink
              to={`/maps/${doc.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-text"
            >
              <Paintbrush className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">Edit map</span>
              <span className="sr-only 2xl:hidden">Edit map</span>
            </AppLink>
          )}
          <Button variant="ghost" onClick={toggleView}>
            <Maximize className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">Full page</span>
            <span className="sr-only 2xl:hidden">Full page</span>
          </Button>
          <Button
            variant="ghost"
            disabled={!scene}
            onClick={() => {
              setExporting(true);
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">Export PNG</span>
            <span className="sr-only 2xl:hidden">Export PNG</span>
          </Button>
          {exporting && scene && (
            <ExportDialog
              doc={doc}
              scene={scene}
              name={doc.name}
              width={doc.width}
              height={doc.height}
              hasGrid={grid.visible}
              hasSecretPins={doc.layers.some((l) =>
                l.items.some((i) => i.kind === 'pin' && i.secret === true),
              )}
              onClose={() => {
                setExporting(false);
              }}
            />
          )}
          {creator && <DeleteMap doc={doc} />}
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
          <ToolRail
            tools={tools}
            tool={tool}
            onPick={(id) => {
              if (wall) finishWall();
              setTool(id);
              setMeasured([]);
              scene?.clearPreview();
              if (TOOLS_WITH_SETTINGS.has(id)) setPanelOpen(true);
            }}
          />
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
            onDoubleClick={(e) => {
              if (wall) {
                finishWall();
                return;
              }
              if (creator && scene && tool === 'select' && isPointItem(selectedItem)) {
                const screen = local(e);
                const at = scene.toMap(screen.x, screen.y);
                const points = insertVertex(
                  handlePoints(selectedItem, doc.grid.size),
                  at,
                  isClosedItem(selectedItem),
                  12 / scene.zoom,
                );
                if (points) commit((d) => applyPoints(d, selectedItem.id, points));
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (placingRef.current)
                setStampTurn((t) => ({ ...t, rotation: (t.rotation + 90) % 360 }));
            }}
            onPointerLeave={() => {
              scene?.hideGhost();
            }}
          />
          {creator && !viewing && (
            <Hotbar
              items={hot}
              selected={stamp}
              onPick={(item) => {
                rememberStamp(item);
                setStamp(item.ref);
                setStampAspect(item.aspect);
                setStampSquares(item.squares ?? null);
                setTool('stamp');
              }}
            />
          )}
          <BottomBar
            gridVisible={grid.visible}
            onGrid={(visible) => {
              commit((d) => ({ ...d, grid: { ...d.grid, visible } }));
            }}
            snap={snap}
            onSnap={setSnap}
            snapStep={grid.snap ?? 1}
            onSnapStep={(step) => {
              commit((d) => {
                const { snap: _old, ...rest } = d.grid;
                return { ...d, grid: step > 1 ? { ...rest, snap: step } : rest };
              });
            }}
            roofs={
              doc.layers.some((l) =>
                l.items.some(
                  (i) => i.kind === 'building' || i.kind === 'district' || i.kind === 'structure',
                ),
              )
                ? doc.hideRoofs !== true
                : null
            }
            onRoofs={(shown) => {
              commit((d) => {
                const { hideRoofs: _old, ...rest } = d;
                return shown ? rest : { ...rest, hideRoofs: true };
              });
            }}
            zoom={zoom}
            square={cursorSquare}
            hint={
              viewing
                ? null
                : holeOf
                  ? 'Cut a hole: click the corners of the area; double-click or Enter to finish, Escape to cancel.'
                  : `${tools.find((t) => t.id === tool)?.label ?? ''}: ${TOOL_HINTS[tool]}`
            }
            selectedName={selectedItem ? selectedName(selectedItem) : null}
          />
          <PinHover scene={scene} host={host} campaignId={doc.campaign} />
          {loadingPicture && (
            <p className="pointer-events-none absolute bottom-12 left-2 rounded-md bg-surface/90 px-3 py-1 text-sm text-muted shadow-card">
              Loading the picture…
            </p>
          )}
          {(wall !== null || measured.length > 0 || tool === 'calibrate') && !viewing && (
            <p
              role="status"
              className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-3 py-1 text-sm shadow-card"
            >
              {tool === 'calibrate'
                ? 'Drag over one grid cell of the picture.'
                : wall && tool === 'route'
                  ? routeStatus(wall, doc)
                  : wall
                    ? tool === 'area' ||
                      tool === 'path' ||
                      tool === 'kit' ||
                      tool === 'scatter' ||
                      tool === 'district' ||
                      tool === 'building' ||
                      tool === 'room'
                      ? 'Click to place points; double-click or Enter to finish, Escape to cancel.'
                      : tool === 'fog'
                        ? 'Click the corners; double-click or Enter to finish the area.'
                        : 'Click to add corners; double-click or Enter to finish the wall.'
                    : measure
                      ? `Distance: ${measure} (Escape to clear)`
                      : 'Click the next point.'}
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
            mode={mode}
            doc={doc}
            open={panelOpen}
            onClose={() => {
              setPanelOpen(false);
            }}
            commit={commit}
            tool={tool}
            setTool={setTool}
            selected={selectedItem ?? null}
            selectedIds={selectedItem ? [selectedItem.id, ...liveGroup] : []}
            onDeselect={() => {
              setSelected(null);
            }}
            layerId={layer?.id ?? ''}
            setLayerId={setLayerId}
            onMeasureFrom={(p) => {
              if (wall) finishWall();
              setTool('measure');
              setSelected(null);
              setMeasured([p]);
              drawMeasured([p]);
            }}
            compare={compare}
            setCompare={setCompare}
            stamp={stamp}
            setStamp={(path, aspect, squares) => {
              rememberStamp({ ref: path, aspect, squares });
              setStamp(path);
              setStampAspect(aspect);
              setStampSquares(squares ?? null);
              // Picked in the Portal tool, it stays the Portal tool's; elsewhere it is for stamping.
              const owner = tool === 'door' ? 'door' : 'stamp';
              setPicks((all) => ({
                ...all,
                [owner]: { ref: path, aspect, squares: squares ?? null },
              }));
              if (tool !== 'door') setTool('stamp', false);
            }}
            brush={brush}
            setBrush={setBrush}
            terrain={terrain}
            setTerrain={pickTerrain}
            terrainSlots={slots}
            eraser={eraser}
            setEraser={setEraser}
            template={template}
            setTemplate={setTemplate}
            fog={fog}
            setFog={setFog}
            light={light}
            setLight={setLight}
            district={district}
            setDistrict={setDistrict}
            buildingSet={buildingSet}
            setBuildingSet={setBuildingLive}
            kitSet={kitSet}
            setKitSet={setKitSet}
            onGenerateTown={generateTownHere}
            elev={elev}
            setElev={setElev}
            roomSet={roomSet}
            setRoomSet={setRoomSet}
            onGenerateDungeon={generateDungeonHere}
            onGenerateCave={generateCaveHere}
            scatter={scatter}
            setScatter={setScatter}
            onScatterOn={scatterOn}
            onCutHole={(id) => {
              setSelected(null);
              setWall(null);
              setTool('area');
              setHoleOf(id);
            }}
            onScatterMix={scatterWithPictures}
            onPlacePrefab={placePrefabHere}
            onFurnish={furnishRoom}
            area={area}
            setArea={setArea}
            pathSet={pathSet}
            setPathSet={setPathLive}
            onGenerate={generate}
            onFillMap={fillMap}
            snap={snap}
            setSnap={setSnap}
            draw={draw}
            setDraw={setDraw}
          />
        )}
      </div>
    </div>
  );
}
