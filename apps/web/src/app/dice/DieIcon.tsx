import type { Faces } from './pool';

/** Outline of each die, drawn in a 32×32 box. */
const SHAPES: Record<Faces, string[]> = {
  4: ['M16 3 L29 27 L3 27 Z'],
  6: ['M5 5 H27 V27 H5 Z'],
  8: ['M16 2 L29 16 L16 30 L3 16 Z', 'M3 16 H29'],
  10: ['M16 2 L28 13 L16 30 L4 13 Z', 'M4 13 L16 18 L28 13'],
  12: ['M16 2 L29 11.5 L24 27 L8 27 L3 11.5 Z'],
  20: ['M16 2 L28.5 9 L28.5 23 L16 30 L3.5 23 L3.5 9 Z', 'M16 8 L24 21 L8 21 Z'],
  100: ['M10 4 L17 11 L10 26 L3 11 Z', 'M22 6 L29 13 L22 28 L15 13 Z'],
};

export function DieIcon({ faces, className }: { faces: Faces; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      {SHAPES[faces].map((d, i) => (
        <path
          key={d}
          d={d}
          fill={i === 0 ? 'currentColor' : 'none'}
          fillOpacity={i === 0 ? 0.12 : 0}
          stroke="currentColor"
          strokeWidth={i === 0 ? 1.8 : 1}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
