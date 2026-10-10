import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { dabPoints, MAX_SLOTS, type Splat, type SplatStroke } from './splat';

/** The masks are at most this many pixels on a side, however big the map. */
const MAX_MASK = 2048;

/** What a slot is painted with: its picture and how much to scale it on the map. */
export interface SlotLook {
  texture: Texture;
  scale: number;
}

interface Slot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mask: Sprite;
  tiles: TilingSprite;
  /** Holds the tiles and their mask. */
  group: Container;
  maskTexture: Texture;
}

/**
 * The terrain of a map drawn from its strokes: each slot is a tiled texture seen through a soft
 * mask, the mask painted with a soft round brush. Painting a slot also takes the paint of the
 * other slots away under the brush, so the newest stroke covers what was there.
 */
export class SplatView {
  readonly container = new Container();
  private slots: Slot[] = [];
  private scale = 1;
  private size = { w: 0, h: 0 };
  /** The strokes drawn so far, to draw only the new ones when strokes are added. */
  private applied: readonly SplatStroke[] = [];
  private slotKey = '';
  /** The slot that Fill covered the map with: always under the others, never rubbed off. */
  private base = -1;

  /** Brings the picture up to date with the splat; draws only what changed. */
  update(
    splat: Splat | undefined,
    mapWidth: number,
    mapHeight: number,
    look: (slot: number) => SlotLook | null,
    tick: string,
  ): void {
    const count = splat?.slots.length ?? 0;
    if (mapWidth !== this.size.w || mapHeight !== this.size.h) this.reset(mapWidth, mapHeight);
    while (this.slots.length > count) this.slots.pop()?.group.destroy({ children: true });
    for (let i = this.slots.length; i < count; i++) this.addSlot(i);
    if (!splat) {
      this.applied = [];
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    const key = `${splat.slots.join('|')}#${tick}#${String(mapWidth)}x${String(mapHeight)}`;
    if (key !== this.slotKey) {
      this.slotKey = key;
      this.slots.forEach((slot, i) => {
        const l = look(i);
        slot.tiles.visible = l !== null;
        if (l) {
          slot.tiles.texture = l.texture;
          slot.tiles.tileScale.set(l.scale);
        }
      });
    }
    const prefix =
      this.applied.length <= splat.strokes.length &&
      this.applied.every((s, i) => s === splat.strokes[i]);
    if (!prefix) {
      this.clear();
      this.applied = [];
    }
    for (const stroke of splat.strokes.slice(this.applied.length)) this.paint(stroke);
    this.applied = splat.strokes;
    this.stackBase();
    this.refresh();
  }

  /** A stroke painted while it is drawn: the map takes it as drawn when it is added to the doc. */
  paintLive(stroke: SplatStroke): void {
    this.paint(stroke);
    this.refresh();
  }

  /** Says the stroke just painted live is now in the map (so it is not painted twice). */
  adopt(stroke: SplatStroke): void {
    this.applied = [...this.applied, stroke];
    this.stackBase();
  }

  private reset(w: number, h: number): void {
    this.size = { w, h };
    this.scale = Math.min(1, MAX_MASK / Math.max(w, h));
    for (const s of this.slots) s.group.destroy({ children: true });
    this.slots = [];
    this.applied = [];
    this.slotKey = '';
    this.base = -1;
  }

  private addSlot(index: number): void {
    if (index >= MAX_SLOTS) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(this.size.w * this.scale));
    canvas.height = Math.max(1, Math.round(this.size.h * this.scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot draw the terrain on this device');
    const maskTexture = Texture.from(canvas);
    const mask = new Sprite(maskTexture);
    mask.width = this.size.w;
    mask.height = this.size.h;
    const tiles = new TilingSprite({
      texture: Texture.WHITE,
      width: this.size.w,
      height: this.size.h,
    });
    const group = new Container();
    group.addChild(tiles, mask);
    tiles.setMask({ mask });
    this.container.addChild(group);
    this.slots.push({ canvas, ctx, mask, tiles, group, maskTexture });
    // A slot made after strokes were drawn has to be drawn from the start.
    this.applied = [];
  }

  /** The base slot goes to the bottom of the stack. */
  private stackBase(): void {
    const group = this.slots[this.base]?.group;
    if (group && this.container.getChildIndex(group) !== 0) this.container.setChildIndex(group, 0);
  }

  private clear(): void {
    this.base = -1;
    for (const s of this.slots) s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
  }

  private refresh(): void {
    for (const s of this.slots) s.maskTexture.source.update();
  }

  private paint(stroke: SplatStroke): void {
    const k = this.scale;
    if (stroke.fill) {
      this.base = stroke.slot;
      this.slots.forEach((s, i) => {
        s.ctx.globalCompositeOperation = i === stroke.slot ? 'source-over' : 'destination-out';
        s.ctx.fillStyle = '#fff';
        s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
      });
      return;
    }
    const r = Math.max(0.5, stroke.radius * k);
    for (const d of dabPoints(stroke.points, stroke.radius)) {
      const x = d.x * k;
      const y = d.y * k;
      const gradient = (ctx: CanvasRenderingContext2D) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(Math.min(0.99, stroke.hardness), 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        return g;
      };
      this.slots.forEach((s, i) => {
        const adds = !stroke.erase && i === stroke.slot;
        // The slot Fill laid under everything stays whole: what shows through is that ground.
        if (!adds && i === this.base) return;
        s.ctx.globalCompositeOperation = adds ? 'source-over' : 'destination-out';
        s.ctx.fillStyle = gradient(s.ctx);
        s.ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.slots = [];
  }
}
