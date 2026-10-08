/** Building blocks of the map maker's side panels. */
import { cn } from '@boh/ui';
import { ImagePlus } from 'lucide-react';
import { type ReactNode } from 'react';
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
