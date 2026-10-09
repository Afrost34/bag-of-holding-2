import {
  AlphaFilter,
  Application,
  Container,
  Culler,
  FillPattern,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type ColorSource,
} from 'pixi.js';
import { fileUrl, stampFile } from './assets';
import { hexCorners, templateOutline, type Point } from './geometry';
import { resizedView, type ViewBase } from './view';
import { hiddenFromPlayers } from './pinLink';
import { pinStyle, type Grid, type MapDoc, type MapItem } from './model';
import { pinIconSvg } from './pinIcons';
import { terrainTile, type TerrainId } from './terrain';

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
export function routeView(points: readonly number[], color: string, width: number): Graphics {
  return drawRoute(new Graphics(), points, color, width);
}

/** Draws a route onto a graphics (a route item, or the one being drawn). */
export function drawRoute(
  g: Graphics,
  points: readonly number[],
  color: string,
  width: number,
): Graphics {
  if (points.length < 2) return g;
  const line = () => {
    g.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i + 1 < points.length; i += 2) g.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  };
  line();
  g.stroke({ color: 0xffffff, width: width + 4, cap: 'round', join: 'round', alpha: 0.9 });
  line();
  g.stroke({ color: colorOf(color), width, cap: 'round', join: 'round' });
  for (let i = 0; i + 1 < points.length; i += 2)
    g.circle(points[i] ?? 0, points[i + 1] ?? 0, width * 1.3)
      .fill({ color: 0xffffff })
      .stroke({ color: colorOf(color), width: Math.max(2, width / 2) });
  return g;
}
const SELECT_COLOR = 0x3b82f6;

const colorOf = (c: string): ColorSource => c;

interface Node {
  item: MapItem;
  view: Container;
  /** What else its look depends on (a pin's category). */
  look: string;
}

/** Pins keep this size on screen, whatever the zoom, so they can be found on a whole world map. */
const PIN_RADIUS = 15;

const iconTextures = new Map<string, Promise<Texture | null>>();

/** A pin icon, drawn white, as a texture (made once). */
function iconTexture(id: string): Promise<Texture | null> {
  let t = iconTextures.get(id);
  if (!t) {
    const svg = pinIconSvg(id, '#ffffff', 64);
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
    iconTextures.set(id, t);
  }
  return t;
}

const terrainPatterns = new Map<TerrainId, FillPattern>();
/** A terrain's texture, repeating across the map (so strokes side by side join up). */
function terrainPattern(id: TerrainId): FillPattern {
  let t = terrainPatterns.get(id);
  if (!t) {
    t = new FillPattern(Texture.from(terrainTile(id)), 'repeat');
    terrainPatterns.set(id, t);
  }
  return t;
}

/** What a brush stroke looks like. */
export interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  texture?: TerrainId | undefined;
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
  private readonly layers = new Container();
  private readonly overlay = new Container();
  private readonly selection = new Graphics();
  private readonly preview = new Graphics();
  private readonly strokePreview = new Container();
  private readonly previewText = new Text({ text: '', style: { fontSize: 22, fill: 0xffffff } });
  private nodes = new Map<string, Node>();
  private layerViews = new Map<string, Container>();
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
    this.world.addChild(this.background, this.layers, this.gridLines, this.overlay);
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
    if (!this.ready) return;
    this.drawBackground(doc);
    this.drawGrid(doc);
    // Layers, bottom first.
    const seen = new Set<string>();
    doc.layers.forEach((layer, index) => {
      let view = this.layerViews.get(layer.id);
      if (!view) {
        view = new Container();
        this.layerViews.set(layer.id, view);
        this.layers.addChild(view);
      }
      view.visible = layer.visible;
      this.layers.setChildIndex(view, index);
      layer.items.forEach((item, i) => {
        seen.add(item.id);
        const node = this.nodes.get(item.id);
        const look = item.kind === 'pin' ? JSON.stringify(pinStyle(doc, item)) : '';
        if (node?.item === item && node.look === look && node.view.parent === view) return;
        if (node) node.view.destroy({ children: true });
        const fresh = this.drawItem(item, doc);
        fresh.cullable = true;
        this.nodes.set(item.id, { item, view: fresh, look });
        view.addChildAt(fresh, Math.min(i, view.children.length));
      });
      // Keep the items in their order within the layer.
      layer.items.forEach((item, i) => {
        const n = this.nodes.get(item.id);
        if (n?.view.parent === view && view.getChildIndex(n.view) !== i)
          view.setChildIndex(n.view, Math.min(i, view.children.length - 1));
      });
    });
    this.scalePins();
    for (const [id, node] of this.nodes)
      if (!seen.has(id)) {
        node.view.destroy({ children: true });
        this.nodes.delete(id);
      }
    for (const [id, view] of this.layerViews)
      if (!doc.layers.some((l) => l.id === id)) {
        view.destroy({ children: true });
        this.layerViews.delete(id);
      }
    this.requestRender();
  }

  /**
   * The paper, the background picture, and the picture layers shown, bottom first. Each picture
   * is loaded once and kept, so showing and hiding one (day and night) is instant.
   */
  private drawBackground(doc: MapDoc): void {
    const paths = [
      doc.background?.path,
      ...(doc.pictures ?? []).filter((p) => p.visible).map((p) => p.path),
    ].filter((p): p is string => typeof p === 'string');
    const key = String(doc.width) + 'x' + String(doc.height) + '|' + paths.join('|');
    if (key === this.backgroundKey) return;
    this.backgroundKey = key;
    this.background.removeChildren();
    this.paper?.destroy();
    this.paper = new Graphics().rect(0, 0, doc.width, doc.height).fill({ color: 0xf3efe6 });
    this.background.addChild(this.paper);
    for (const path of paths) {
      let view = this.pictureViews.get(path);
      if (!view) {
        view = new Container();
        this.pictureViews.set(path, view);
        this.loadPicture(path, view);
      }
      this.background.addChild(view);
    }
    this.requestRender();
  }

  /** The scene was destroyed while a picture loaded, or the picture was let go. */
  private dropped(path: string, view: Container): boolean {
    return this.destroyed || this.pictureViews.get(path) !== view;
  }

  private loadPicture(path: string, view: Container): void {
    this.onLoading(true);
    void fileUrl(path)
      .then(async (url) => {
        if (!url || this.dropped(path, view)) return;
        const blob = await (await fetch(url)).blob();
        const bitmap = await createImageBitmap(blob);
        for (let y = 0; y < bitmap.height; y += TILE)
          for (let x = 0; x < bitmap.width; x += TILE) {
            const w = Math.min(TILE, bitmap.width - x);
            const h = Math.min(TILE, bitmap.height - y);
            const tile = await createImageBitmap(bitmap, x, y, w, h);
            if (this.dropped(path, view)) return;
            const sprite = new Sprite(Texture.from(tile));
            sprite.position.set(x, y);
            sprite.cullable = true;
            view.addChild(sprite);
            this.requestRender();
          }
        bitmap.close();
      })
      .finally(() => {
        this.onLoading(false);
      });
  }

  private drawGrid(doc: MapDoc): void {
    const g = doc.grid;
    const key = `${g.type}|${String(g.size)}|${String(g.offsetX)}|${String(g.offsetY)}|${String(g.opacity)}|${String(doc.width)}|${String(doc.height)}`;
    if (key === this.gridKey) return;
    this.gridKey = key;
    for (const c of this.gridLines.removeChildren())
      c.destroy({ texture: true, textureSource: true });
    if (g.type === 'none' || g.opacity <= 0) return;
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
        void textureFor(stampFile(item.stamp)).then((texture) => {
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
      case 'wall': {
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
        return routeView(item.points, item.color, routeWidth(doc));
      case 'text': {
        const t = new Text({
          text: item.text,
          style: {
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: item.size,
            fontWeight: '700',
            fill: colorOf(item.color),
            stroke: { color: 0xffffff, width: Math.max(2, item.size / 8) },
            align: 'center',
          },
        });
        t.anchor.set(0.5);
        t.position.set(item.x, item.y);
        return t;
      }
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

  /** The topmost item under a map point, on visible unlocked layers. */
  hit(p: Point): MapItem | null {
    if (!this.doc) return null;
    for (const layer of [...this.doc.layers].reverse()) {
      if (!layer.visible || layer.locked) continue;
      for (const item of [...layer.items].reverse()) {
        if (this.forPlayers && hiddenFromPlayers(item)) continue;
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
  exportCanvas({ withGrid, scale = 1, pinScale = 1 }: ExportOptions): HTMLCanvasElement {
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
      // Pins back to screen size.
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
