import {
  AlphaFilter,
  Application,
  Container,
  Culler,
  FillPattern,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
  type ColorSource,
} from 'pixi.js';
import { fileUrl, stampFile } from './assets';
import { scaleBarLabel, scaleBarSpec } from './scaleBar';
import { arcLayout, dashSegments, dotsAlong, type RouteDash } from './lettering';
import { hexCorners, templateOutline, type Point } from './geometry';
import { bounds } from './spline';
import { resizedView, type ViewBase } from './view';
import { hiddenFromPlayers } from './pinLink';
import {
  artHash,
  fogHides,
  PAPERS,
  isArt,
  itemShown,
  layerShown,
  pinStyle,
  type Grid,
  type MapDoc,
  type MapItem,
} from './model';
import { pinIconSvg } from './pinIcons';
import { glyphIdOf, glyphTexture, isGlyphRef } from './glyphs';
import { itemBox } from './arrange';
import { heightsOf, shadeImage, type Elevation } from './elevation';
import { alongLayout, targetLine } from './labels';
import { buildingView, districtView } from './cityView';
import { roomDoorsView, roomFloorView, roomWallView } from './roomView';
import { roomOutline } from './rooms';
import { districtGeo, districtOutline } from './cityDoc';
import { isTied, obstacleSignature, pieceBox, scatterLine, scatterOf } from './scatterDoc';
import { pathLine, pathView, shapeOutline, shapeView } from './shapes';
import { pointInPolygon } from './polygon';
import { stripSegments } from './wallStrip';
import { isPackTexture, TERRAINS, terrainTile, type TerrainRef } from './terrain';

/**
 * The map canvas (PixiJS, WebGL): background, grid, layers of items, and an overlay for what is
 * being drawn or picked. React tells it what the map is (`setDoc`); it rebuilds only what changed,
 * and draws a frame only when something changed (`requestRender`), leaving out what is off screen.
 * Kept out of React so drags and brush strokes do not re-render the page.
 */

/** Background pictures are cut into tiles: big pictures exceed what some GPUs take at once. */
const TILE = 2048;

const textures = new Map<string, Promise<Texture | null>>();

async function textureFor(path: string): Promise<Texture | null> {
  let t = textures.get(path);
  if (!t) {
    t = fileUrl(path).then(async (url) => {
      if (!url) return null;
      const blob = await (await fetch(url)).blob();
      return Texture.from(await createImageBitmap(blob));
    });
    textures.set(path, t);
  }
  return t;
}

export const WALL_COLOR = 0x2b2420;

/** How thick a route is drawn: readable on a large world map, not heavy on a small one. */
export const routeWidth = (doc: Pick<MapDoc, 'width' | 'height'>) =>
  Math.max(4, Math.round(Math.max(doc.width, doc.height) / 200));

/** A route: a line with a white edge and a dot at each stop. */
export function routeView(
  points: readonly number[],
  color: string,
  width: number,
  dash?: RouteDash,
): Graphics {
  return drawRoute(new Graphics(), points, color, width, dash);
}

/** Draws a route onto a graphics (a route item, or the one being drawn). */
export function drawRoute(
  g: Graphics,
  points: readonly number[],
  color: string,
  width: number,
  dash?: RouteDash,
): Graphics {
  if (points.length < 2) return g;
  if (dash === 'dotted') {
    // Round dots on a white rim, a little more than a dot apart.
    const dots = dotsAlong(points, width * 2.6);
    for (const p of dots) g.circle(p.x, p.y, width * 0.75 + 2);
    g.fill({ color: 0xffffff, alpha: 0.9 });
    for (const p of dots) g.circle(p.x, p.y, width * 0.75);
    g.fill({ color: colorOf(color) });
  } else {
    const lines = dash === 'dashed' ? dashSegments(points, width * 4, width * 2.5) : [[...points]];
    const draw = () => {
      for (const l of lines) {
        g.moveTo(l[0] ?? 0, l[1] ?? 0);
        for (let i = 2; i + 1 < l.length; i += 2) g.lineTo(l[i] ?? 0, l[i + 1] ?? 0);
      }
    };
    draw();
    g.stroke({ color: 0xffffff, width: width + 4, cap: 'round', join: 'round', alpha: 0.9 });
    draw();
    g.stroke({ color: colorOf(color), width, cap: 'round', join: 'round' });
  }
  for (let i = 0; i + 1 < points.length; i += 2)
    g.circle(points[i] ?? 0, points[i + 1] ?? 0, width * 1.3)
      .fill({ color: 0xffffff })
      .stroke({ color: colorOf(color), width: Math.max(2, width / 2) });
  return g;
}
const SELECT_COLOR = 0x3b82f6;

const colorOf = (c: string): ColorSource => c;

/** Whether the map writes anything in the fantasy font (its pins, or a region label). */
const usesFantasyFont = (doc: MapDoc) =>
  doc.pinStyle === 'fantasy' ||
  doc.scaleBar === 'fantasy' ||
  doc.layers.some((l) => l.items.some((i) => i.kind === 'text' && i.font === 'fantasy'));

/**
 * Text on the map: bold with a white rim, or lettered as on an old map (the fantasy font on a
 * parchment halo), spaced out, turned and bent along an arc.
 */
function textView(
  item: Extract<MapItem, { kind: 'text' }>,
  line: readonly number[] | null = null,
): Container {
  const fantasy = item.font === 'fantasy';
  const style = {
    fontFamily: fantasy ? FANTASY_FONT : 'Merriweather, Georgia, serif',
    fontSize: item.size,
    fontWeight: fantasy ? ('400' as const) : ('700' as const),
    fill: colorOf(item.color),
    stroke: fantasy
      ? { color: PARCHMENT, width: Math.max(2, item.size / 6) }
      : { color: 0xffffff, width: Math.max(2, item.size / 8) },
    align: 'center' as const,
  };
  const spacing = ((item.spacing ?? 0) / 100) * item.size;
  const holder = new Container();
  if (line && line.length >= 4) {
    // Set along a river, a road or a coast: each letter on the line, turned with it.
    const letters = Array.from(
      new Intl.Segmenter().segment(item.text),
      (g) => new Text({ text: g.segment, style }),
    );
    const placed = alongLayout(
      letters.map((t) => t.width),
      spacing,
      line,
      item.along ?? 0.5,
      item.lift ?? -item.size * 0.6,
    );
    letters.forEach((t, i) => {
      const p = placed[i];
      if (!p) return;
      t.anchor.set(0.5);
      t.position.set(p.x, p.y);
      t.rotation = p.angle;
      holder.addChild(t);
    });
    return holder;
  }
  holder.position.set(item.x, item.y);
  holder.rotation = ((item.rotation ?? 0) * Math.PI) / 180;
  const curve = item.curve ?? 0;
  if (curve === 0 || item.text.includes('\n')) {
    const t = new Text({ text: item.text, style: { ...style, letterSpacing: spacing } });
    t.anchor.set(0.5);
    holder.addChild(t);
    return holder;
  }
  const letters = Array.from(
    new Intl.Segmenter().segment(item.text),
    (g) => new Text({ text: g.segment, style }),
  );
  const placed = arcLayout(
    letters.map((t) => t.width),
    spacing,
    curve,
  );
  letters.forEach((t, i) => {
    const p = placed[i];
    if (!p) return;
    t.anchor.set(0.5);
    t.position.set(p.x, p.y);
    t.rotation = p.angle;
    holder.addChild(t);
  });
  return holder;
}

interface Node {
  item: MapItem;
  view: Container;
  /** What else its look depends on (a pin's category). */
  look: string;
  /** Parts drawn elsewhere (a room's walls under the layer's floors, its doors over them). */
  extras?: Container[];
}

/** Pins keep this size on screen, whatever the zoom, so they can be found on a whole world map. */
const PIN_RADIUS = 15;

const iconTextures = new Map<string, Promise<Texture | null>>();

/**
 * Fantasy-map pins (a map's `pinStyle`): inked icons on a parchment halo, names in an old
 * printer's italic (IM Fell English, bundled with the app).
 */
const INK = '#2b1d0e';
const PARCHMENT = '#f3e9d2';
const FANTASY_FONT = '"IM Fell English", Georgia, serif';
/** The italic is in the browser's font list once loaded; names drawn before then are redrawn. */
let fantasyFontReady = false;
let fantasyFontLoading: Promise<unknown> | null = null;

/** A pin icon, drawn white (or in `color`, `width` thick), as a texture (made once). */
function iconTexture(id: string, color = '#ffffff', width = 2.25): Promise<Texture | null> {
  const textureKey = `${id}|${color}|${String(width)}`;
  let t = iconTextures.get(textureKey);
  if (!t) {
    const svg = pinIconSvg(id, color, 64, width);
    t = svg
      ? new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve(Texture.from(img));
          };
          img.onerror = () => {
            resolve(null);
          };
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        })
      : Promise.resolve(null);
    iconTextures.set(textureKey, t);
  }
  return t;
}

const terrainPatterns = new Map<string, FillPattern>();
/** Pictures of asset packs used as textures, once loaded (null while they load). */
const packTextures = new Map<string, Texture | null>();
/** Counts the pack textures that have arrived: items drawn with one are drawn again when it changes. */
let packTexturesReady = 0;
let onPackTexture: (() => void) | null = null;
/** The grid of the map being drawn: a pack texture spans a few of its squares. */
let patternGrid = 70;
const PACK_TEXTURE_SQUARES = 5;

/** The look of an item that depends on pack pictures still arriving. */
const packLook = (item: MapItem): string => {
  const refs = [
    item.kind === 'room' ? item.floor : 'texture' in item ? item.texture : undefined,
    item.kind === 'room' ? item.wallTexture : item.kind === 'wall' ? item.texture : undefined,
  ];
  return refs.some((r) => r && isPackTexture(r))
    ? String(packTexturesReady) + '|' + String(patternGrid)
    : '';
};

/** A pack picture used as a texture, once it has loaded (null until then; the load starts at the first ask). */
export function packTexture(ref: string): Texture | null {
  const loaded = packTextures.get(ref);
  if (loaded === undefined) {
    packTextures.set(ref, null);
    void textureFor(stampFile(ref)).then((tex) => {
      if (!tex) return;
      packTextures.set(ref, tex);
      packTexturesReady++;
      onPackTexture?.();
    });
  }
  return loaded ?? null;
}

/**
 * A wall made of a pack's strip picture, repeated along each segment: a strip is one grid square
 * tall in its picture, drawn here at the grid's size. Null while the picture loads.
 */
export function stripWallView(
  points: readonly number[],
  closed: boolean,
  ref: string,
  gridSize: number,
): Container | null {
  const texture = packTexture(ref);
  if (!texture) return null;
  const holder = new Container();
  const k = gridSize / Math.max(1, texture.height);
  const thickness = gridSize * 0.3;
  for (const s of stripSegments(points, closed, thickness)) {
    const strip = new TilingSprite({ texture, width: s.length / k, height: texture.height });
    strip.anchor.set(0, 0.5);
    strip.scale.set(k);
    strip.position.set(s.x, s.y);
    strip.rotation = s.angle;
    holder.addChild(strip);
  }
  return holder;
}

/**
 * A texture, repeating across the map (so strokes side by side join up). A picture of a pack is
 * loaded first: until it is there the pattern is a plain stone one, and the item is drawn again.
 */
function terrainPattern(ref: TerrainRef): FillPattern {
  if (!isPackTexture(ref)) {
    let t = terrainPatterns.get(ref);
    if (!t) {
      t = new FillPattern(Texture.from(terrainTile(ref)), 'repeat');
      terrainPatterns.set(ref, t);
    }
    return t;
  }
  const loaded = packTexture(ref);
  if (!loaded) return terrainPattern('stone');
  const key = ref + '|' + String(patternGrid);
  let t = terrainPatterns.get(key);
  if (!t) {
    t = new FillPattern(loaded, 'repeat');
    const k = (patternGrid * PACK_TEXTURE_SQUARES) / Math.max(1, loaded.width);
    t.setTransform(new Matrix().scale(k, k));
    terrainPatterns.set(key, t);
  }
  return t;
}

/** What a brush stroke looks like. */
export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  texture?: TerrainRef | undefined;
}

/**
 * A brush stroke: a line in a colour or a terrain texture. Opacity is applied to
 * the whole stroke at once, so where it crosses itself it does not get darker.
 */
function strokeView(points: readonly number[], style: StrokeStyle): Container {
  const line = new Graphics();
  if (points.length >= 2) {
    line.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i + 1 < points.length; i += 2) line.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    if (points.length === 2) line.lineTo((points[0] ?? 0) + 0.1, points[1] ?? 0);
  }
  line.stroke({
    ...(style.texture ? { fill: terrainPattern(style.texture) } : { color: colorOf(style.color) }),
    width: style.width,
    cap: 'round',
    join: 'round',
  });
  const view: Container = line;
  if (style.opacity < 1) view.filters = [new AlphaFilter({ alpha: style.opacity })];
  return view;
}

export class MapScene {
  readonly app = new Application();
  /** Pans and zooms. */
  readonly world = new Container();
  private readonly background = new Container();
  /** The grid: one-pixel lines, however big the map. */
  private readonly gridLines = new Container();
  /** The scale bar, over the items (kept in exports). */
  private readonly scaleBarView = new Container();
  private scaleBarKey = '';
  private readonly layers = new Container();
  private readonly renderView = new Container();
  private renderKey = '';
  /** The flat picture of the art is showing, so the art itself is left out. */
  private renderActive = false;
  /** Pictures and stamps still loading (see `settled`). */
  private loading = 0;
  private readonly elevationView = new Container();
  private elevationKey = '';
  private readonly fog = new Container();
  private fogKey = '';
  private readonly overlay = new Container();
  private readonly selection = new Graphics();
  private readonly preview = new Graphics();
  private readonly strokePreview = new Container();
  private readonly previewText = new Text({ text: '', style: { fontSize: 22, fill: 0xffffff } });
  private nodes = new Map<string, Node>();
  private layerViews = new Map<string, Container>();
  /** Where the walls of a layer's rooms go: under everything else on it. */
  private wallHolders = new Map<string, Container>();
  /** Where the doors of a layer's rooms go: over everything else on it. */
  private topHolders = new Map<string, Container>();
  private doc: MapDoc | null = null;
  private backgroundKey = '';
  private paper: Graphics | null = null;
  /** Pictures loaded (background and picture layers), by asset path. */
  private readonly pictureViews = new Map<string, Container>();
  private gridKey = '';
  private ready = false;
  /** Told when the background picture starts and finishes loading. */
  onLoading: (loading: boolean) => void = () => undefined;
  private destroyed = false;
  private frame = 0;
  private resizing: ResizeObserver | null = null;
  /** Scale the view with the host when it is resized (a map in a board card), not just crop it. */
  followResize = false;
  /** The players see it (the player window): pins hidden from them are left off. */
  forPlayers = false;
  /** The Creator shows the map's art only: pins and routes are the Viewer's (set before `setDoc`). */
  hideAnnotations = false;
  /** Show the flat picture of the art when the map has a fresh one (the Viewer, boards). */
  useRender = false;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      preference: 'webgl',
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      // Frames are drawn on demand (see requestRender).
      autoStart: false,
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.previewText.style.stroke = { color: 0x000000, width: 4 };
    this.overlay.addChild(this.strokePreview, this.preview, this.selection, this.previewText);
    this.world.addChild(
      this.background,
      this.renderView,
      this.layers,
      this.elevationView,
      this.fog,
      this.gridLines,
      this.scaleBarView,
      this.overlay,
    );
    this.app.stage.addChild(this.world);
    this.ready = true;
    let size = { w: host.clientWidth, h: host.clientHeight };
    /**
     * The view as last set by hand (or by `fit`), and the host size it was set at. Every resize
     * scales from it, never from the previous resize: a host that shrinks and grows back shows
     * exactly what it showed before, instead of drifting smaller each time.
     */
    let base: ViewBase | null = null;
    /** The view a resize set last: anything else means it was changed by hand since. */
    let resized: { x: number; y: number; zoom: number } | null = null;
    this.resizing = new ResizeObserver(() => {
      const next = { w: host.clientWidth, h: host.clientHeight };
      if (next.w === size.w && next.h === size.h) return;
      // The canvas takes the host's new size now (Pixi itself only follows the window).
      this.app.resize();
      if (this.followResize && size.w > 0 && size.h > 0 && next.w > 0 && next.h > 0) {
        const moved =
          resized?.x !== this.world.x ||
          resized.y !== this.world.y ||
          resized.zoom !== this.world.scale.x;
        if (!base || moved)
          base = {
            w: size.w,
            h: size.h,
            zoom: this.world.scale.x,
            middle: this.toMap(size.w / 2, size.h / 2),
          };
        // The view grows and shrinks with the host: what was in the middle stays there.
        const view = resizedView(base, next);
        this.setView(view.x, view.y, view.zoom);
        resized = { x: this.world.x, y: this.world.y, zoom: this.world.scale.x };
      }
      size = next;
      this.requestRender();
    });
    this.resizing.observe(host);
    if (this.doc) this.setDoc(this.doc);
    this.requestRender();
  }

  /** Draws a frame soon (once, however many changes come before it). */
  requestRender(): void {
    if (this.frame || !this.ready || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.destroyed) return;
      Culler.shared.cull(this.world, this.app.screen);
      this.app.render();
    });
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizing?.disconnect();
    // Pictures not on screen now are not children of the stage: destroy them too.
    for (const view of this.pictureViews.values())
      if (!view.parent) view.destroy({ children: true });
    this.pictureViews.clear();
    if (this.ready) this.app.destroy(true, { children: true });
  }

  /** Map coordinates of a point on screen (relative to the canvas). */
  toMap(x: number, y: number): Point {
    const s = this.world.scale.x;
    return { x: (x - this.world.x) / s, y: (y - this.world.y) / s };
  }

  get zoom(): number {
    return this.world.scale.x;
  }

  setView(x: number, y: number, zoom: number): void {
    this.world.position.set(x, y);
    this.world.scale.set(zoom);
    this.scalePins();
    this.requestRender();
  }

  /** Pins are drawn at screen size: scaled against the zoom. */
  private scalePins(): void {
    const k = 1 / this.world.scale.x;
    for (const { item, view } of this.nodes.values()) if (item.kind === 'pin') view.scale.set(k);
  }

  /** Zooms by `factor` keeping the map point under (x, y) where it is. */
  zoomAt(x: number, y: number, factor: number): void {
    const before = this.toMap(x, y);
    const zoom = Math.min(8, Math.max(0.02, this.world.scale.x * factor));
    this.world.scale.set(zoom);
    this.world.position.set(x - before.x * zoom, y - before.y * zoom);
    this.scalePins();
    this.requestRender();
  }

  panBy(dx: number, dy: number): void {
    this.world.position.set(this.world.x + dx, this.world.y + dy);
    this.requestRender();
  }

  /** Brings a map point to the middle of the view, zoomed in a little if the map is far out. */
  centerOn(p: Point, minZoom = 0.35): void {
    const zoom = Math.max(this.zoom, minZoom);
    this.setView(
      this.app.screen.width / 2 - p.x * zoom,
      this.app.screen.height / 2 - p.y * zoom,
      zoom,
    );
  }

  /** The whole map in view. */
  fit(): void {
    if (!this.doc) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const zoom = Math.min(w / this.doc.width, h / this.doc.height) * 0.95;
    this.setView((w - this.doc.width * zoom) / 2, (h - this.doc.height * zoom) / 2, zoom);
  }

  setDoc(doc: MapDoc): void {
    this.doc = doc;
    patternGrid = doc.grid.size;
    onPackTexture = () => {
      if (this.doc && !this.destroyed) this.setDoc(this.doc);
    };
    if (!this.ready) return;
    if (usesFantasyFont(doc) && !fantasyFontReady && typeof document !== 'undefined') {
      fantasyFontLoading ??= Promise.all([
        document.fonts.load(`italic 18px ${FANTASY_FONT}`),
        document.fonts.load(`18px ${FANTASY_FONT}`),
      ]);
      void fantasyFontLoading.then(() => {
        fantasyFontReady = true;
        if (this.doc && !this.destroyed) this.setDoc(this.doc);
      });
    }
    this.drawBackground(doc);
    this.drawGrid(doc);
    this.drawScaleBar(doc);
    // Layers, bottom first.
    const seen = new Set<string>();
    const pictureKeys = new Set<string>();
    // What scatter reacts to (roads, rivers, shapes): scatter is made again when it changes.
    const obstacles = doc.layers.some((l) =>
      l.items.some(
        (i) => i.kind === 'scatter' || i.kind === 'district' || (i.kind === 'text' && i.follow),
      ),
    )
      ? obstacleSignature(doc)
      : '';
    doc.layers.forEach((layer, index) => {
      let view = this.layerViews.get(layer.id);
      if (!view) {
        view = new Container();
        this.layerViews.set(layer.id, view);
        this.layers.addChild(view);
      }
      view.visible = layerShown(doc, layer);
      this.layers.setChildIndex(view, index);
      if (layer.picture) {
        // A picture layer: loaded once and kept, so showing and hiding it is instant.
        const key = layer.id + '|' + layer.picture.path;
        pictureKeys.add(key);
        if (!this.pictureViews.has(key)) {
          const pic = new Container();
          this.pictureViews.set(key, pic);
          view.addChildAt(pic, 0);
          this.loadPicture(key, layer.picture.path, pic);
        }
      }
      let walls = this.wallHolders.get(layer.id);
      if (!layer.picture && (!walls || walls.destroyed)) {
        walls = new Container();
        this.wallHolders.set(layer.id, walls);
        view.addChildAt(walls, 0);
      }
      let tops = this.topHolders.get(layer.id);
      if (!layer.picture && (!tops || tops.destroyed)) {
        tops = new Container();
        this.topHolders.set(layer.id, tops);
        view.addChild(tops);
      }
      layer.items.forEach((item, i) => {
        seen.add(item.id);
        const node = this.nodes.get(item.id);
        const look =
          item.kind === 'scatter' || item.kind === 'district'
            ? obstacles
            : item.kind === 'text' && item.follow
              ? obstacles + String(fantasyFontReady)
              : item.kind === 'pin'
                ? JSON.stringify([pinStyle(doc, item), doc.pinStyle ?? '', fantasyFontReady])
                : item.kind === 'text' && item.font === 'fantasy'
                  ? String(fantasyFontReady)
                  : packLook(item);
        const home = item.under === true && walls ? walls : view;
        if (node?.item === item && node.look === look && node.view.parent === home) return;
        if (node) {
          node.view.destroy({ children: true });
          for (const e of node.extras ?? []) e.destroy({ children: true });
        }
        const fresh = this.drawItem(item, doc);
        fresh.cullable = !['path', 'shape', 'scatter', 'district', 'building', 'room'].includes(
          item.kind,
        );
        if (this.hideAnnotations && (item.kind === 'pin' || item.kind === 'route'))
          fresh.visible = false;
        const extras: Container[] = [];
        if (item.kind === 'room' && walls && tops) {
          const wallView = roomWallView(
            item,
            item.wallTexture && isPackTexture(item.wallTexture)
              ? stripWallView(
                  roomOutline(item.points, item.smooth),
                  true,
                  item.wallTexture,
                  doc.grid.size,
                )
              : null,
          );
          walls.addChild(wallView);
          const doorView = roomDoorsView(item);
          tops.addChild(doorView);
          extras.push(wallView, doorView);
        }
        this.nodes.set(item.id, { item, view: fresh, look, ...(extras.length ? { extras } : {}) });
        // Index 0 of a layer is its walls (or its picture); the items follow. Items put under the
        // others share the walls' holder, below them.
        if (home === view) view.addChildAt(fresh, Math.min(i + 1, view.children.length));
        else home.addChildAt(fresh, 0);
      });
      // Keep the items in their order within the layer.
      layer.items.forEach((item, i) => {
        const n = this.nodes.get(item.id);
        if (n?.view.parent === view && view.getChildIndex(n.view) !== i + 1)
          view.setChildIndex(n.view, Math.min(i + 1, view.children.length - 1));
      });
      if (tops && view.getChildIndex(tops) !== view.children.length - 1)
        view.setChildIndex(tops, view.children.length - 1);
    });
    for (const [key, pic] of this.pictureViews)
      if (!pictureKeys.has(key)) {
        pic.destroy({ children: true });
        this.pictureViews.delete(key);
      }
    this.drawFog(doc);
    this.drawElevation(doc.elevation);
    this.drawRender(doc);
    this.applyVisibility(doc);
    this.scalePins();
    for (const [id, node] of this.nodes)
      if (!seen.has(id)) {
        node.view.destroy({ children: true });
        for (const e of node.extras ?? []) e.destroy({ children: true });
        this.nodes.delete(id);
      }
    for (const [id, view] of this.layerViews)
      if (!doc.layers.some((l) => l.id === id)) {
        view.destroy({ children: true });
        this.layerViews.delete(id);
      }
    this.requestRender();
  }

  /** The paper the map is on; pictures are layers of their own. */
  private drawBackground(doc: MapDoc): void {
    const paper = PAPERS.find((p) => p.id === doc.paper) ?? PAPERS[0];
    const key = String(doc.width) + 'x' + String(doc.height) + paper.id;
    if (key === this.backgroundKey) return;
    this.backgroundKey = key;
    this.background.removeChildren();
    this.paper?.destroy();
    this.paper = new Graphics()
      .rect(0, 0, doc.width, doc.height)
      .fill({ color: Number.parseInt(paper.color.replace('#', ''), 16) });
    this.background.addChild(this.paper);
    this.requestRender();
  }

  /**
   * The fog: areas the players cannot see yet, laid and cut in order on a small canvas. The DM
   * sees it faint over the map, the players see it black.
   */
  private drawFog(doc: MapDoc): void {
    const shapes = doc.reveal ?? [];
    const key = JSON.stringify([shapes, doc.width, doc.height, this.forPlayers]);
    if (key === this.fogKey) return;
    this.fogKey = key;
    for (const c of this.fog.removeChildren()) c.destroy({ children: true });
    if (shapes.length === 0 || typeof document === 'undefined') return;
    const k = Math.min(1, 2048 / Math.max(doc.width, doc.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(doc.width * k));
    canvas.height = Math.max(1, Math.round(doc.height * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b0b10';
    for (const shape of shapes) {
      ctx.globalCompositeOperation = shape.revealed ? 'destination-out' : 'source-over';
      ctx.beginPath();
      for (let i = 0; i + 1 < shape.points.length; i += 2) {
        const x = (shape.points[i] ?? 0) * k;
        const y = (shape.points[i + 1] ?? 0) * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    const sprite = new Sprite(Texture.from(canvas));
    sprite.scale.set(1 / k);
    sprite.alpha = this.forPlayers ? 1 : 0.5;
    this.fog.addChild(sprite);
  }

  /** Hill shading over the layers: one small picture, stretched over the map. */
  private drawElevation(e: Elevation | undefined, heights?: Uint8Array): void {
    const key = e
      ? [e.data.length, e.data.slice(0, 64), e.data.slice(-64), e.sea, e.strength, e.tint].join('|')
      : '';
    if (!heights && key === this.elevationKey) return;
    this.elevationKey = heights ? '' : key;
    for (const c of this.elevationView.removeChildren()) c.destroy({ children: true });
    if (!e || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = e.w;
    canvas.height = e.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixels = shadeImage(e, heights ?? heightsOf(e));
    ctx.putImageData(new ImageData(pixels, e.w, e.h), 0, 0);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'linear';
    const sprite = new Sprite(texture);
    sprite.scale.set(e.cell);
    this.elevationView.addChild(sprite);
    this.requestRender();
  }

  /** Shows heights as they are being painted, before they are kept. */
  previewElevation(e: Elevation, heights: Uint8Array): void {
    this.drawElevation(e, heights);
  }

  /**
   * The flat picture of the art, for devices without the stamp packs: used when the map has one
   * made from exactly this art. Until it has loaded the art itself stays, so nothing flashes.
   */
  private drawRender(doc: MapDoc): void {
    const r = this.useRender && doc.render?.hash === artHash(doc) ? doc.render : null;
    const path = r ? (r.images[doc.activeVariant ?? '-'] ?? r.images['-'] ?? '') : '';
    if (path === this.renderKey) return;
    this.renderKey = path;
    for (const c of this.renderView.removeChildren()) c.destroy({ children: true });
    this.renderActive = false;
    if (!r || !path) return;
    const view = new Container();
    view.scale.set(doc.width / r.width);
    this.renderView.addChild(view);
    this.loadTiles(path, view, () => {
      if (this.destroyed || this.renderKey !== path || !this.doc) return;
      this.renderActive = true;
      this.applyVisibility(this.doc);
      this.requestRender();
    });
  }

  /**
   * What shows: the active variant's items, the Creator's no pins or routes, the players' no
   * secret pins, and no pin in a hidden category.
   */
  private applyVisibility(doc: MapDoc): void {
    for (const [id, node] of this.nodes) {
      const item = node.item;
      let shown = itemShown(doc, id);
      if (this.hideAnnotations && (item.kind === 'pin' || item.kind === 'route')) shown = false;
      if (this.renderActive && isArt(item)) shown = false;
      if (item.kind === 'pin')
        shown &&=
          !pinStyle(doc, item).hidden &&
          !(this.forPlayers && (item.secret === true || fogHides(doc, item.x, item.y)));
      node.view.visible = shown;
      for (const e of node.extras ?? []) e.visible = shown;
    }
    for (const pic of this.pictureViews.values()) pic.visible = !this.renderActive;
  }

  /** The texture of a stamp reference: a glyph drawn in code, or a picture. */
  private stampTexture(ref: string): Promise<Texture | null> {
    const glyph = isGlyphRef(ref) ? glyphIdOf(ref) : null;
    if (glyph) return Promise.resolve(glyphTexture(this.app.renderer, glyph));
    return textureFor(stampFile(ref));
  }

  /** The pieces of a scatter: made from its seed, standing on their base, back to front. */
  private scatterView(item: Extract<MapItem, { kind: 'scatter' }>, doc: MapDoc): Container {
    const holder = new Container();
    const list = scatterOf(doc, item);
    this.loading++;
    void Promise.all(item.pieces.map((p) => this.stampTexture(p.ref))).then((textures) => {
      this.loading--;
      if (holder.destroyed) return;
      for (const inst of list) {
        const texture = textures[inst.piece];
        if (!texture) continue;
        const sprite = new Sprite(texture);
        const box = pieceBox(doc, item, inst, texture.width / Math.max(1, texture.height));
        // Glyphs stand on their base; pictures are centred.
        sprite.anchor.set(0.5, box.base ? 0.92 : 0.5);
        sprite.width = box.w;
        sprite.height = box.h;
        sprite.rotation = inst.angle;
        sprite.position.set(inst.x, inst.y);
        holder.addChild(sprite);
      }
      this.requestRender();
    });
    return holder;
  }

  private loadPicture(_key: string, path: string, view: Container): void {
    this.loadTiles(path, view);
  }

  /** A picture cut into tiles under `view`; `done` once all are there. */
  private loadTiles(path: string, view: Container, done?: () => void): void {
    this.loading++;
    this.onLoading(true);
    const gone = () => this.destroyed || view.destroyed;
    void fileUrl(path)
      .then(async (url) => {
        if (!url || gone()) return;
        const blob = await (await fetch(url)).blob();
        const bitmap = await createImageBitmap(blob);
        for (let y = 0; y < bitmap.height; y += TILE)
          for (let x = 0; x < bitmap.width; x += TILE) {
            const w = Math.min(TILE, bitmap.width - x);
            const h = Math.min(TILE, bitmap.height - y);
            const tile = await createImageBitmap(bitmap, x, y, w, h);
            if (gone()) return;
            const sprite = new Sprite(Texture.from(tile));
            sprite.position.set(x, y);
            sprite.cullable = true;
            view.addChild(sprite);
            this.requestRender();
          }
        bitmap.close();
        done?.();
      })
      .finally(() => {
        this.loading--;
        this.onLoading(false);
      });
  }

  /** Resolves when the pictures and stamps asked for so far have loaded (or after 30 s). */
  async settled(): Promise<void> {
    const until = Date.now() + 30_000;
    await new Promise((r) => setTimeout(r, 50));
    while (this.loading > 0 && Date.now() < until && !this.destroyed)
      await new Promise((r) => setTimeout(r, 50));
    this.requestRender();
  }

  /**
   * The scale bar in the bottom-left corner: alternating blocks with the distance above, in black
   * and white, or in ink on parchment with old lettering.
   */
  private drawScaleBar(doc: MapDoc): void {
    const spec = doc.scaleBar ? scaleBarSpec(doc) : null;
    const key = JSON.stringify([doc.scaleBar, spec, doc.width, doc.height, fantasyFontReady]);
    if (key === this.scaleBarKey) return;
    this.scaleBarKey = key;
    for (const c of this.scaleBarView.removeChildren()) c.destroy({ children: true });
    if (!spec || !doc.scaleBar) return;
    const fantasy = doc.scaleBar === 'fantasy';
    const dark = fantasy ? INK : '#111111';
    const light = fantasy ? PARCHMENT : '#ffffff';
    const h = Math.max(6, spec.length / 16);
    const margin = Math.min(doc.width, doc.height) * 0.04;
    const holder = new Container();
    holder.position.set(margin, doc.height - margin - h);
    const g = new Graphics();
    // A rim so it reads on any picture.
    g.rect(-h * 0.4, -h * 0.4, spec.length + h * 0.8, h * 1.8).fill({ color: light, alpha: 0.75 });
    const block = spec.length / spec.segments;
    for (let i = 0; i < spec.segments; i++)
      g.rect(i * block, 0, block, h).fill({ color: i % 2 === 0 ? dark : light });
    g.rect(0, 0, spec.length, h).stroke({ color: dark, width: Math.max(1.5, h / 6) });
    holder.addChild(g);
    const size = Math.max(14, spec.length / 7);
    const style = {
      fontFamily: fantasy ? FANTASY_FONT : 'Merriweather, Georgia, serif',
      fontStyle: fantasy ? ('italic' as const) : ('normal' as const),
      fontWeight: fantasy ? ('400' as const) : ('700' as const),
      fontSize: size,
      fill: dark,
      stroke: { color: light, width: Math.max(3, size / 5) },
    };
    const label = (text: string, x: number, anchorX: number) => {
      const t = new Text({ text, style, resolution: 2 });
      t.anchor.set(anchorX, 1);
      t.position.set(x, -h * 0.5);
      holder.addChild(t);
    };
    label('0', 0, 0.5);
    label(scaleBarLabel(spec), spec.length, 0.5);
    if (fantasy) {
      // "Scale of Miles" under the bar, as old maps have it.
      const unit = spec.unit === 'ft' ? 'Feet' : spec.unit === 'km' ? 'Kilometres' : 'Miles';
      const t = new Text({
        text: `Scale of ${unit}`,
        style: { ...style, fontSize: size * 0.8 },
        resolution: 2,
      });
      t.anchor.set(0.5, 0);
      t.position.set(spec.length / 2, h * 1.5);
      holder.addChild(t);
      holder.y -= size * 0.9;
    }
    this.scaleBarView.addChild(holder);
  }

  private drawGrid(doc: MapDoc): void {
    const g = doc.grid;
    const key = `${String(g.visible)}|${g.type}|${String(g.size)}|${String(g.offsetX)}|${String(g.offsetY)}|${String(g.opacity)}|${String(doc.width)}|${String(doc.height)}`;
    if (key === this.gridKey) return;
    this.gridKey = key;
    for (const c of this.gridLines.removeChildren())
      c.destroy({ texture: true, textureSource: true });
    if (!g.visible || g.opacity <= 0) return;
    const lines = gridGraphics(g, doc.width, doc.height);
    lines.alpha = g.opacity;
    this.gridLines.addChild(lines);
  }

  private drawItem(item: MapItem, doc: MapDoc): Container {
    const grid = doc.grid;
    switch (item.kind) {
      case 'stamp': {
        const holder = new Container();
        holder.position.set(item.x, item.y);
        holder.rotation = (item.rotation * Math.PI) / 180;
        this.loading++;
        void this.stampTexture(item.stamp).then((texture) => {
          this.loading--;
          if (holder.destroyed) return;
          if (!texture) {
            holder.addChild(
              new Graphics()
                .rect(-item.w / 2, -item.h / 2, item.w, item.h)
                .stroke({ color: 0xff0000, width: 2 }),
            );
            return;
          }
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.width = item.w;
          sprite.height = item.h;
          if (item.flipX) sprite.scale.x *= -1;
          if (item.flipY) sprite.scale.y *= -1;
          holder.addChild(sprite);
          this.requestRender();
        });
        return holder;
      }
      case 'stroke':
        return strokeView(item.points, {
          color: item.color,
          width: item.width,
          opacity: item.opacity,
          texture: item.texture,
        });
      case 'room':
        return roomFloorView(item, terrainPattern(item.floor), floorColor(item.floor));
      case 'district':
        return districtView(item, districtGeo(doc, item));
      case 'building':
        return buildingView(item);
      case 'scatter':
        return this.scatterView(item, doc);
      case 'shape':
        return shapeView(item, item.texture ? terrainPattern(item.texture) : null);
      case 'path':
        return pathView(item);
      case 'wall': {
        if (item.texture && isPackTexture(item.texture)) {
          const strips = stripWallView(item.points, false, item.texture, grid.size);
          if (strips) return strips;
        }
        const g = new Graphics();
        const p = item.points;
        if (p.length >= 2) {
          g.moveTo(p[0] ?? 0, p[1] ?? 0);
          for (let i = 2; i + 1 < p.length; i += 2) g.lineTo(p[i] ?? 0, p[i + 1] ?? 0);
          if (p.length === 2) g.lineTo((p[0] ?? 0) + 0.1, p[1] ?? 0);
        }
        g.stroke({
          color: WALL_COLOR,
          width: Math.max(6, grid.size * 0.14),
          cap: 'round',
          join: 'round',
        });
        return g;
      }
      case 'route':
        return routeView(item.points, item.color, routeWidth(doc), item.dash);
      case 'text':
        return textView(item, item.follow ? targetLine(doc, item.follow) : null);
      case 'template': {
        const g = new Graphics();
        const o = templateOutline(item.shape, item, item.feet, item.angle, grid);
        if (o.circle) g.circle(o.circle.x, o.circle.y, o.circle.r);
        if (o.polygon) g.poly(o.polygon.flatMap((p) => [p.x, p.y]));
        g.fill({ color: colorOf(item.color), alpha: 0.25 }).stroke({
          color: colorOf(item.color),
          width: 3,
          alpha: 0.9,
        });
        return g;
      }
      case 'pin': {
        // A round badge with the icon, on a short stem pointing at the place, then the label.
        const style = pinStyle(doc, item);
        const holder = new Container();
        holder.position.set(item.x, item.y);
        holder.visible = !style.hidden && !(this.forPlayers && item.secret);
        // Hidden from players: faint for the DM, so it is plain which pins they will not see.
        if (item.secret) holder.alpha = 0.55;
        const r = PIN_RADIUS;
        if (doc.pinStyle === 'fantasy') return this.fantasyPin(holder, item.label, style.icon);
        const color = colorOf(style.color);
        const marker = new Graphics()
          .moveTo(0, 0)
          .lineTo(-r * 0.45, -r * 1.2)
          .lineTo(r * 0.45, -r * 1.2)
          .closePath()
          .fill({ color })
          .circle(0, -r * 1.75, r)
          .fill({ color })
          .stroke({ color: 0xffffff, width: 2.5 });
        holder.addChild(marker);
        if (style.icon) {
          void iconTexture(style.icon).then((texture) => {
            if (!texture || holder.destroyed) return;
            const icon = new Sprite(texture);
            icon.anchor.set(0.5);
            icon.width = r * 1.15;
            icon.height = r * 1.15;
            icon.position.set(0, -r * 1.75);
            holder.addChild(icon);
            this.requestRender();
          });
        } else {
          holder.addChild(new Graphics().circle(0, -r * 1.75, r * 0.38).fill({ color: 0xffffff }));
        }
        if (item.label) {
          const t = new Text({
            text: item.label,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: '600',
              fill: 0x111111,
              stroke: { color: 0xffffff, width: 4 },
            },
            resolution: 2,
          });
          t.anchor.set(0.5, 0);
          t.position.set(0, 3);
          holder.addChild(t);
        }
        return holder;
      }
    }
  }

  /**
   * A pin as on a fantasy map: an inked icon on a parchment halo (a town's dot when it has no
   * icon), the name below in an old printer's italic.
   */
  private fantasyPin(holder: Container, label: string, icon: string | null): Container {
    const r = PIN_RADIUS;
    if (icon) {
      const size = r * 2.6;
      const place = (texture: Texture | null) => {
        if (!texture || holder.destroyed) return;
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = size;
        sprite.height = size;
        sprite.position.set(0, -r * 1.15);
        holder.addChild(sprite);
        this.requestRender();
      };
      // The halo first, so the ink sits on it.
      void iconTexture(icon, PARCHMENT, 6).then((halo) => {
        place(halo);
        void iconTexture(icon, INK, 2).then(place);
      });
    } else {
      holder.addChild(
        new Graphics()
          .circle(0, -r * 0.5, r * 0.5)
          .fill({ color: PARCHMENT })
          .stroke({ color: INK, width: 2 })
          .circle(0, -r * 0.5, r * 0.22)
          .fill({ color: INK }),
      );
    }
    if (label) {
      const t = new Text({
        text: label,
        style: {
          fontFamily: FANTASY_FONT,
          fontStyle: 'italic',
          fontSize: 18,
          fill: INK,
          stroke: { color: PARCHMENT, width: 5 },
        },
        resolution: 2,
      });
      t.anchor.set(0.5, 0);
      t.position.set(0, 2);
      holder.addChild(t);
    }
    return holder;
  }

  /** The topmost item under a map point, on visible unlocked layers. */
  hit(p: Point): MapItem | null {
    if (!this.doc) return null;
    for (const layer of [...this.doc.layers].reverse()) {
      if (!layerShown(this.doc, layer) || layer.locked) continue;
      for (const item of [...layer.items].reverse()) {
        if (this.forPlayers && hiddenFromPlayers(item)) continue;
        if (this.hideAnnotations && (item.kind === 'pin' || item.kind === 'route')) continue;
        if (!itemShown(this.doc, item.id)) continue;
        if (this.forPlayers && item.kind === 'pin' && fogHides(this.doc, item.x, item.y)) continue;
        if (item.kind === 'stroke' || item.kind === 'wall' || item.kind === 'route') {
          const width =
            item.kind === 'wall'
              ? 10
              : item.kind === 'route'
                ? routeWidth(this.doc)
                : item.width / 2;
          const tolerance = width + 6 / this.zoom;
          if (nearPolyline(p, item.points, tolerance)) return item;
          continue;
        }
        if (item.kind === 'shape') {
          // A shape that covers most of the map is a backdrop (an ocean): a click does not pick it.
          const outline = shapeOutline(item);
          const b = bounds(outline);
          if ((b.x1 - b.x0) * (b.y1 - b.y0) > this.doc.width * this.doc.height * 0.8) continue;
          if (pointInPolygon(p, outline)) return item;
          continue;
        }
        if (item.kind === 'room') {
          if (pointInPolygon(p, roomOutline(item.points, item.smooth))) return item;
          continue;
        }
        if (item.kind === 'district' || item.kind === 'building') {
          const outline = item.kind === 'district' ? districtOutline(item) : item.points;
          if (pointInPolygon(p, outline)) return item;
          continue;
        }
        if (item.kind === 'scatter') {
          const line = scatterLine(this.doc, item);
          if (item.mode === 'area') {
            if (pointInPolygon(p, line)) return item;
          } else if (nearPolyline(p, line, item.spacing + item.offset + 6 / this.zoom)) return item;
          continue;
        }
        if (item.kind === 'path') {
          const tolerance = item.width / 2 + 6 / this.zoom;
          if (nearPolyline(p, pathLine(item), tolerance)) return item;
          continue;
        }
        if (item.kind === 'stamp') {
          const a = (-item.rotation * Math.PI) / 180;
          const dx = p.x - item.x;
          const dy = p.y - item.y;
          const lx = dx * Math.cos(a) - dy * Math.sin(a);
          const ly = dx * Math.sin(a) + dy * Math.cos(a);
          if (Math.abs(lx) <= item.w / 2 && Math.abs(ly) <= item.h / 2) return item;
          continue;
        }
        const view = this.nodes.get(item.id)?.view;
        if (!view) continue;
        const b = view.getBounds();
        const tl = this.toMap(b.x, b.y);
        const br = this.toMap(b.x + b.width, b.y + b.height);
        if (p.x >= tl.x && p.x <= br.x && p.y >= tl.y && p.y <= br.y) return item;
      }
    }
    return null;
  }

  /** Outlines the picked item. */
  select(item: MapItem | null): void {
    const g = this.selection.clear();
    this.requestRender();
    if (!item) return;
    const w = 2 / this.zoom;
    if (item.kind === 'stamp') {
      const a = (item.rotation * Math.PI) / 180;
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx = 0, sy = 0]) => {
        const x = (sx * item.w) / 2;
        const y = (sy * item.h) / 2;
        return [
          item.x + x * Math.cos(a) - y * Math.sin(a),
          item.y + x * Math.sin(a) + y * Math.cos(a),
        ];
      });
      g.poly(corners.flat()).stroke({ color: SELECT_COLOR, width: w * 1.5 });
      return;
    }
    if (item.kind === 'district' || item.kind === 'building' || item.kind === 'room') {
      const outline =
        item.kind === 'district'
          ? districtOutline(item)
          : item.kind === 'room'
            ? roomOutline(item.points, item.smooth)
            : item.points;
      if (outline.length >= 6) g.poly(outline).stroke({ color: SELECT_COLOR, width: w });
      for (let i = 0; i + 1 < item.points.length; i += 2)
        g.circle(item.points[i] ?? 0, item.points[i + 1] ?? 0, 5 / this.zoom)
          .fill({ color: 0xffffff })
          .stroke({ color: SELECT_COLOR, width: w });
      return;
    }
    if (item.kind === 'scatter' && this.doc) {
      const line = scatterLine(this.doc, item);
      if (line.length >= 4)
        g.poly(line, item.mode === 'area').stroke({ color: SELECT_COLOR, width: w });
      if (!isTied(item))
        for (let i = 0; i + 1 < item.points.length; i += 2)
          g.circle(item.points[i] ?? 0, item.points[i + 1] ?? 0, 5 / this.zoom)
            .fill({ color: 0xffffff })
            .stroke({ color: SELECT_COLOR, width: w });
      return;
    }
    if (
      item.kind === 'shape' ||
      item.kind === 'path' ||
      item.kind === 'wall' ||
      item.kind === 'route'
    ) {
      // The outline, and a handle on each control point to drag.
      const line =
        item.kind === 'shape'
          ? shapeOutline(item)
          : item.kind === 'path'
            ? pathLine(item)
            : item.points;
      if (line.length >= 4)
        g.poly(line, item.kind === 'shape').stroke({ color: SELECT_COLOR, width: w });
      for (let i = 0; i + 1 < item.points.length; i += 2)
        g.circle(item.points[i] ?? 0, item.points[i + 1] ?? 0, 5 / this.zoom)
          .fill({ color: 0xffffff })
          .stroke({ color: SELECT_COLOR, width: w });
      return;
    }
    const view = this.nodes.get(item.id)?.view;
    if (!view) return;
    const b = view.getBounds();
    const tl = this.toMap(b.x, b.y);
    const br = this.toMap(b.x + b.width, b.y + b.height);
    g.rect(tl.x - 4, tl.y - 4, br.x - tl.x + 8, br.y - tl.y + 8).stroke({
      color: SELECT_COLOR,
      width: w * 1.5,
    });
  }

  /** Several items picked: a box round each (no handles). */
  selectMany(items: readonly MapItem[]): void {
    const g = this.selection.clear();
    this.requestRender();
    const w = 2 / this.zoom;
    for (const item of items) {
      const b = itemBox(item);
      g.rect(b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6).stroke({
        color: SELECT_COLOR,
        width: w * 1.5,
      });
    }
  }

  /** Moves the drawn items (while dragging a group) by this much, without a new map. */
  nudgeBy(items: readonly MapItem[], dx: number, dy: number): void {
    for (const item of items) {
      const view = this.nodes.get(item.id)?.view;
      if (!view) continue;
      if ('x' in item) view.position.set(item.x + dx, item.y + dy);
      else view.position.set(dx, dy);
    }
    this.requestRender();
  }

  /** Moves the drawn item (while dragging) without a new map. */
  nudge(id: string, x: number, y: number): void {
    const view = this.nodes.get(id)?.view;
    if (view) view.position.set(x, y);
    this.requestRender();
  }

  /** What is being drawn: a brush stroke, a wall, a measuring line, a template. */
  drawPreview(draw: (g: Graphics) => void, label?: { text: string; at: Point }): void {
    const g = this.preview.clear();
    draw(g);
    this.requestRender();
    this.previewText.text = label?.text ?? '';
    this.previewText.visible = Boolean(label);
    if (label) {
      this.previewText.position.set(label.at.x + 12 / this.zoom, label.at.y + 12 / this.zoom);
      this.previewText.scale.set(1 / this.zoom);
    }
  }

  /** A measured path: its legs, a dot at each point, and what it measures by the last point. */
  drawMeasure(points: readonly Point[], label: string | null): void {
    const last = points.at(-1);
    this.drawPreview(
      (g) => {
        const [first, ...rest] = points;
        if (!first) return;
        g.moveTo(first.x, first.y);
        for (const p of rest) g.lineTo(p.x, p.y);
        g.stroke({ color: 0xfacc15, width: 4 / this.zoom });
        for (const p of points) g.circle(p.x, p.y, 6 / this.zoom).fill({ color: 0xfacc15 });
      },
      label && last ? { text: label, at: last } : undefined,
    );
  }

  /** A brush stroke being drawn, as it will look once kept. */
  previewStroke(points: readonly number[], style: StrokeStyle): void {
    for (const c of this.strokePreview.removeChildren()) c.destroy({ children: true });
    this.strokePreview.addChild(strokeView(points, style));
    this.requestRender();
  }

  clearPreview(): void {
    for (const c of this.strokePreview.removeChildren()) c.destroy({ children: true });
    this.preview.clear();
    this.previewText.visible = false;
    this.requestRender();
  }

  /**
   * The whole map as a picture: drawn in tiles (one GPU frame cannot hold an 8k map) into one
   * canvas, at `scale` of its own size, pins `pinScale` times their on-screen size (on the map
   * they keep one size on screen whatever the zoom, so a print needs a size of its own). The
   * overlay is left out.
   */
  exportCanvas({
    withGrid,
    scale = 1,
    pinScale = 1,
    withSecretPins = true,
  }: ExportOptions): HTMLCanvasElement {
    if (!this.doc) throw new Error('No map');
    const { width, height } = this.doc;
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(width * scale));
    out.height = Math.max(1, Math.round(height * scale));
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Cannot draw the picture on this device');
    const view = { x: this.world.x, y: this.world.y, zoom: this.world.scale.x };
    this.overlay.visible = false;
    this.gridLines.visible = withGrid;
    this.setView(0, 0, 1);
    for (const { item, view: v } of this.nodes.values())
      if (item.kind === 'pin') v.scale.set(pinScale);
    // Pins hidden from players: in the picture at full strength, or left out, as asked.
    const secret = [...this.nodes.values()].filter(
      (n) => n.item.kind === 'pin' && n.item.secret === true,
    );
    const shown = secret.map((n) => n.view.visible);
    for (const n of secret) {
      n.view.alpha = 1;
      if (!withSecretPins) n.view.visible = false;
    }
    // Everything is drawn, on screen or not.
    uncull(this.world);
    try {
      for (let y = 0; y < height; y += TILE)
        for (let x = 0; x < width; x += TILE) {
          const frame = new Rectangle(x, y, Math.min(TILE, width - x), Math.min(TILE, height - y));
          const tile = this.app.renderer.extract.canvas({
            target: this.world,
            frame,
            resolution: scale,
          });
          ctx.drawImage(tile as HTMLCanvasElement, Math.round(x * scale), Math.round(y * scale));
        }
    } finally {
      this.overlay.visible = true;
      this.gridLines.visible = true;
      // Pins back to screen size, the secret ones faint again.
      secret.forEach((n, i) => {
        n.view.alpha = 0.55;
        n.view.visible = shown[i] ?? true;
      });
      this.setView(view.x, view.y, view.zoom);
    }
    return out;
  }

  /** The map as a PNG file (see `exportCanvas`). */
  async exportPng(options: ExportOptions): Promise<Blob> {
    const out = this.exportCanvas(options);
    return new Promise((resolve, reject) => {
      out.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Could not make the picture'));
      }, 'image/png');
    });
  }
}

export interface ExportOptions {
  withGrid: boolean;
  /** Size of the picture against the map's own (1 = full size). */
  scale?: number;
  /** Pins' size against their size on screen. */
  pinScale?: number;
  /** Pins hidden from players in the picture too (they are by default). */
  withSecretPins?: boolean;
}

function nearPolyline(p: Point, points: readonly number[], tolerance: number): boolean {
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i] ?? 0;
    const ay = points[i + 1] ?? 0;
    const bx = points[i + 2] ?? 0;
    const by = points[i + 3] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len));
    if (Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy)) <= tolerance) return true;
  }
  return (
    points.length === 2 && Math.hypot(p.x - (points[0] ?? 0), p.y - (points[1] ?? 0)) <= tolerance
  );
}

function uncull(c: Container): void {
  c.culled = false;
  for (const child of c.children) uncull(child);
}

/**
 * The grid's lines over the whole map, one screen pixel wide whatever the zoom (so they neither
 * vanish when zoomed out nor thicken when zoomed in).
 */
function gridGraphics(grid: Grid, width: number, height: number): Graphics {
  const g = new Graphics();
  const size = grid.size;
  if (grid.type === 'square') {
    const x0 = ((grid.offsetX % size) + size) % size;
    const y0 = ((grid.offsetY % size) + size) % size;
    for (let x = x0; x <= width; x += size) g.moveTo(x, 0).lineTo(x, height);
    for (let y = y0; y <= height; y += size) g.moveTo(0, y).lineTo(width, y);
  } else {
    const radius = size / Math.sqrt(3);
    const row = radius * 1.5;
    const local: Grid = { ...grid, offsetX: 0, offsetY: 0 };
    const rows = Math.ceil(height / row) + 2;
    const cols = Math.ceil(width / size) + 2;
    const r0 = Math.floor(-grid.offsetY / row) - 1;
    for (let r = r0; r < r0 + rows; r++) {
      const q0 = Math.floor((-grid.offsetX - (size * r) / 2) / size) - 1;
      for (let q = q0; q < q0 + cols; q++) {
        const centre = { x: grid.offsetX + size * (q + r / 2), y: grid.offsetY + row * r };
        const corners = hexCorners(centre, local);
        corners.forEach((c, i) => {
          if (i === 0) g.moveTo(c.x, c.y);
          else g.lineTo(c.x, c.y);
        });
        g.closePath();
      }
    }
  }
  return g.stroke({ color: 0x000000, width: 1, pixelLine: true });
}

/** A terrain's base colour (the floor of a room before its texture is made). */
const floorColor = (id: TerrainRef): string => TERRAINS.find((t) => t.id === id)?.base ?? '#9a958d';
