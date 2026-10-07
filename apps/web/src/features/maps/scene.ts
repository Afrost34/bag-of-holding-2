import {
  Application,
  Container,
  Culler,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
  type ColorSource,
} from 'pixi.js';
import { fileUrl, stampFile } from '../../app/maps/assets';
import { hexCorners, templateOutline, type Point } from '../../app/maps/geometry';
import type { Grid, MapDoc, MapItem } from '../../app/maps/model';

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
const SELECT_COLOR = 0x3b82f6;

const colorOf = (c: string): ColorSource => c;

interface Node {
  item: MapItem;
  view: Container;
}

export class MapScene {
  readonly app = new Application();
  /** Pans and zooms. */
  readonly world = new Container();
  private readonly background = new Container();
  /** The grid: one repeating tile, however big the map. */
  private readonly gridLines = new Container();
  private readonly layers = new Container();
  private readonly overlay = new Container();
  private readonly selection = new Graphics();
  private readonly preview = new Graphics();
  private readonly previewText = new Text({ text: '', style: { fontSize: 22, fill: 0xffffff } });
  private nodes = new Map<string, Node>();
  private layerViews = new Map<string, Container>();
  private doc: MapDoc | null = null;
  private backgroundPath: string | null = null;
  private gridKey = '';
  private ready = false;
  /** Told when the background picture starts and finishes loading. */
  onLoading: (loading: boolean) => void = () => undefined;
  private destroyed = false;
  private frame = 0;
  private resizing: ResizeObserver | null = null;

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
    this.overlay.addChild(this.preview, this.selection, this.previewText);
    this.world.addChild(this.background, this.layers, this.gridLines, this.overlay);
    this.app.stage.addChild(this.world);
    this.ready = true;
    this.resizing = new ResizeObserver(() => {
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
    this.requestRender();
  }

  /** Zooms by `factor` keeping the map point under (x, y) where it is. */
  zoomAt(x: number, y: number, factor: number): void {
    const before = this.toMap(x, y);
    const zoom = Math.min(8, Math.max(0.02, this.world.scale.x * factor));
    this.world.scale.set(zoom);
    this.world.position.set(x - before.x * zoom, y - before.y * zoom);
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
        if (node?.item === item && node.view.parent === view) return;
        if (node) node.view.destroy({ children: true });
        const fresh = this.drawItem(item, doc.grid);
        fresh.cullable = true;
        this.nodes.set(item.id, { item, view: fresh });
        view.addChildAt(fresh, Math.min(i, view.children.length));
      });
      // Keep the items in their order within the layer.
      layer.items.forEach((item, i) => {
        const n = this.nodes.get(item.id);
        if (n?.view.parent === view && view.getChildIndex(n.view) !== i)
          view.setChildIndex(n.view, Math.min(i, view.children.length - 1));
      });
    });
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

  private drawBackground(doc: MapDoc): void {
    const path = doc.background?.path ?? null;
    if (path === this.backgroundPath) return;
    this.backgroundPath = path;
    for (const c of this.background.removeChildren()) c.destroy();
    const paper = new Graphics().rect(0, 0, doc.width, doc.height).fill({ color: 0xf3efe6 });
    this.background.addChild(paper);
    if (!path) return;
    this.onLoading(true);
    void fileUrl(path)
      .then(async (url) => {
        if (!url || this.backgroundPath !== path) return;
        const blob = await (await fetch(url)).blob();
        const bitmap = await createImageBitmap(blob);
        for (let y = 0; y < bitmap.height; y += TILE)
          for (let x = 0; x < bitmap.width; x += TILE) {
            const w = Math.min(TILE, bitmap.width - x);
            const h = Math.min(TILE, bitmap.height - y);
            const tile = await createImageBitmap(bitmap, x, y, w, h);
            if (this.backgroundPath !== path || this.destroyed) return;
            const sprite = new Sprite(Texture.from(tile));
            sprite.position.set(x, y);
            sprite.cullable = true;
            this.background.addChild(sprite);
            this.requestRender();
          }
        bitmap.close();
      })
      .finally(() => {
        if (this.backgroundPath === path) this.onLoading(false);
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
    const tile = gridTile(g);
    const sprite = new TilingSprite({
      texture: Texture.from(tile.canvas),
      width: doc.width,
      height: doc.height,
    });
    sprite.tileScale.set(tile.scaleX, tile.scaleY);
    sprite.tilePosition.set(g.offsetX, g.offsetY);
    sprite.alpha = g.opacity;
    this.gridLines.addChild(sprite);
  }

  private drawItem(item: MapItem, grid: Grid): Container {
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
      case 'wall': {
        const g = new Graphics();
        const p = item.points;
        if (p.length >= 2) {
          g.moveTo(p[0] ?? 0, p[1] ?? 0);
          for (let i = 2; i + 1 < p.length; i += 2) g.lineTo(p[i] ?? 0, p[i + 1] ?? 0);
          if (p.length === 2) g.lineTo((p[0] ?? 0) + 0.1, p[1] ?? 0);
        }
        if (item.kind === 'wall')
          g.stroke({
            color: WALL_COLOR,
            width: Math.max(6, grid.size * 0.14),
            cap: 'round',
            join: 'round',
          });
        else
          g.stroke({
            color: colorOf(item.color),
            width: item.width,
            alpha: item.opacity,
            cap: 'round',
            join: 'round',
          });
        return g;
      }
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
        const holder = new Container();
        holder.position.set(item.x, item.y);
        const r = Math.max(14, grid.size * 0.28);
        const marker = new Graphics()
          .moveTo(0, 0)
          .lineTo(-r * 0.7, -r * 1.4)
          .arc(0, -r * 1.6, r * 0.75, Math.PI * 0.8, Math.PI * 0.2)
          .lineTo(0, 0)
          .fill({ color: item.map ? 0x7c3aed : 0xc2410c })
          .stroke({ color: 0xffffff, width: 3 });
        holder.addChild(marker);
        if (item.label) {
          const t = new Text({
            text: item.label,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: Math.max(16, r),
              fontWeight: '600',
              fill: 0x111111,
              stroke: { color: 0xffffff, width: 4 },
            },
          });
          t.anchor.set(0.5, 0);
          t.position.set(0, 4);
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
        if (item.kind === 'stroke' || item.kind === 'wall') {
          const tolerance = (item.kind === 'wall' ? 10 : item.width / 2) + 6 / this.zoom;
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

  clearPreview(): void {
    this.preview.clear();
    this.previewText.visible = false;
    this.requestRender();
  }

  /**
   * The whole map at full size as a PNG: drawn in tiles (one GPU frame cannot hold an 8k map) into
   * one canvas. The overlay is left out.
   */
  async exportPng(withGrid: boolean): Promise<Blob> {
    if (!this.doc) throw new Error('No map');
    const { width, height } = this.doc;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Cannot draw the picture on this device');
    const view = { x: this.world.x, y: this.world.y, zoom: this.world.scale.x };
    this.overlay.visible = false;
    this.gridLines.visible = withGrid;
    this.setView(0, 0, 1);
    // Everything is drawn, on screen or not.
    uncull(this.world);
    try {
      for (let y = 0; y < height; y += TILE)
        for (let x = 0; x < width; x += TILE) {
          const frame = new Rectangle(x, y, Math.min(TILE, width - x), Math.min(TILE, height - y));
          const tile = this.app.renderer.extract.canvas({
            target: this.world,
            frame,
            resolution: 1,
          });
          ctx.drawImage(tile as HTMLCanvasElement, x, y);
        }
    } finally {
      this.overlay.visible = true;
      this.gridLines.visible = true;
      this.setView(view.x, view.y, view.zoom);
    }
    return new Promise((resolve, reject) => {
      out.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Could not make the picture'));
      }, 'image/png');
    });
  }
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
 * One period of the grid, drawn at twice its size for sharp lines: a square cell, or for hexes a
 * tile one hex wide and two rows high.
 */
function gridTile(grid: Grid): { canvas: HTMLCanvasElement; scaleX: number; scaleY: number } {
  const k = 2;
  const w = grid.size;
  const h = grid.type === 'hex' ? Math.sqrt(3) * grid.size : grid.size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w * k));
  canvas.height = Math.max(2, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(canvas.width / w, canvas.height / h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    if (grid.type === 'square') {
      ctx.beginPath();
      ctx.moveTo(0, 0.75);
      ctx.lineTo(w, 0.75);
      ctx.moveTo(0.75, 0);
      ctx.lineTo(0.75, h);
      ctx.stroke();
    } else {
      // Centres in and around the tile; what falls outside is cut off and drawn by the next tile.
      const radius = grid.size / Math.sqrt(3);
      const local: Grid = { ...grid, offsetX: 0, offsetY: 0 };
      for (let r = -1; r <= 2; r++)
        for (let q = -2; q <= 2; q++) {
          const centre = { x: grid.size * (q + r / 2), y: radius * 1.5 * r };
          const corners = hexCorners(centre, local);
          ctx.beginPath();
          corners.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        }
    }
  }
  return { canvas, scaleX: w / canvas.width, scaleY: h / canvas.height };
}
