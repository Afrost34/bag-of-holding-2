/** The light a picked stamp gives: on by itself for candles and lit braziers, off, or changed. */
import { refGlow, stampGlow, type Glow } from '../../app/maps/glow';
import type { MapItem } from '../../app/maps/model';

type Stamp = Extract<MapItem, { kind: 'stamp' }>;

const LAMP: Glow = { squares: 4, color: '#ffd9a0', intensity: 0.8 };

export function StampLight({
  item,
  set,
}: {
  item: Stamp;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const own = refGlow(item.stamp);
  const glow = stampGlow(item);
  const change = (light: Stamp['light'] | undefined) => {
    set((i) => {
      if (i.kind !== 'stamp') return i;
      const { light: _old, ...rest } = i;
      return light === undefined ? rest : { ...rest, light };
    });
  };
  /** A change to the light: kept as the stamp's own (the picture's stays as a starting point). */
  const edit = (patch: Partial<Glow>) => {
    change({ ...(glow ?? LAMP), ...patch });
  };
  return (
    <div role="group" aria-label="Light" className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={glow !== null}
          onChange={(e) => {
            // On: the picture's own light if it has one; off: no light at all.
            if (e.target.checked) change(own ? undefined : LAMP);
            else change(false);
          }}
        />
        Gives light{own && item.light === undefined ? ' (as its picture does)' : ''}
      </label>
      {glow && (
        <>
          <label className="block text-sm">
            Reach: {glow.squares} squares
            <input
              type="range"
              min={1}
              max={12}
              step={0.5}
              value={glow.squares}
              aria-label="Light reach"
              onChange={(e) => {
                edit({ squares: Number(e.target.value) });
              }}
              className="w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Colour
            <input
              type="color"
              aria-label="Light colour"
              value={glow.color}
              onChange={(e) => {
                edit({ color: e.target.value });
              }}
              className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
            />
          </label>
          {item.light !== undefined && own && (
            <button
              type="button"
              onClick={() => {
                change(undefined);
              }}
              className="text-xs text-accent-ink underline"
            >
              Back to the picture's own light
            </button>
          )}
        </>
      )}
    </div>
  );
}
