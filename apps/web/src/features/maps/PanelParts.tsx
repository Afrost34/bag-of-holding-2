/** Building blocks of the map maker's side panels. */
import { cn } from '@boh/ui';
import { ImagePlus } from 'lucide-react';
import { type ReactNode } from 'react';
import {
  clampSides,
  MAX_SIDES,
  MIN_SIDES,
  SHAPE_KINDS,
  type ShapeChoice,
  type ShapeKind,
} from '../../app/maps/outline';
import { field } from './panelTypes';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="font-serif text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-0.5 text-muted hover:bg-sunken hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className={field}
      />
    </label>
  );
}

/** A button that opens the file picker for a picture (a real input, so it works everywhere). */
export function PictureFile({
  label,
  busy,
  onFile,
}: {
  label: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sunken',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <ImagePlus className="h-4 w-4" aria-hidden />
      {busy ? 'Reading…' : label}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

const SHAPE_ICON: Record<ShapeKind, string> = {
  free: 'M4 18 L8 6 L14 12 L20 4',
  rect: 'M4 6 H20 V18 H4 Z',
  circle: 'M12 4 a8 8 0 1 0 0.01 0 Z',
  triangle: 'M12 4 L21 19 H3 Z',
  ngon: 'M12 3 L20 9 L17 19 H7 L4 9 Z',
};

/**
 * How an area tool draws: clicked corner by corner, or dragged out as a rectangle, circle,
 * triangle or regular polygon (any number of sides). Shift keeps it square, Alt starts at its centre.
 */
export function ShapePicker({
  draw,
  setDraw,
  label = 'Draw as',
}: {
  draw: ShapeChoice;
  setDraw: (c: ShapeChoice) => void;
  label?: string;
}) {
  const current = SHAPE_KINDS.find((k) => k.id === draw.kind);
  return (
    <div className="space-y-1.5">
      <p className="text-sm">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
        {SHAPE_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={draw.kind === k.id}
            aria-label={k.label}
            title={`${k.label}: ${k.hint}`}
            onClick={() => {
              setDraw({ ...draw, kind: k.id });
            }}
            className={cn(
              'flex h-9 items-center justify-center rounded-md border',
              draw.kind === k.id
                ? 'border-accent bg-accent-soft text-text'
                : 'border-border text-muted hover:bg-sunken',
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d={SHAPE_ICON[k.id]}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      {draw.kind === 'ngon' && (
        <label className="block text-sm">
          Sides: {draw.sides}
          <input
            type="range"
            aria-label="Sides of the polygon"
            min={MIN_SIDES}
            max={MAX_SIDES}
            value={draw.sides}
            onChange={(e) => {
              setDraw({ ...draw, sides: clampSides(Number(e.target.value)) });
            }}
            className="w-full"
          />
        </label>
      )}
      <p className="text-xs text-muted">
        {current?.hint}
        {draw.kind !== 'free' && '. Shift keeps it square, Alt starts from the middle.'}
      </p>
    </div>
  );
}
