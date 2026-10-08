import { cn } from '@boh/ui';
import type { SVGProps } from 'react';
import { LOGO_PATH, LOGO_VIEWBOX } from './logoShape';

/** The BH mark, in the brand gold (the same in both themes: it sits on the dark chrome). */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" {...props}>
      <path d={LOGO_PATH} fill="var(--boh-brand)" fillRule="evenodd" />
    </svg>
  );
}

/** The title as on a rulebook cover: BAG, a small gold "— OF —", HOLDING. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex flex-col items-center font-serif leading-none font-bold tracking-wider uppercase',
        className,
      )}
    >
      <span>Bag</span>
      <span className="my-0.5 text-[0.5em] tracking-[0.25em] text-brand" aria-hidden>
        — of —
      </span>
      <span className="sr-only">of</span>
      <span>Holding</span>
    </span>
  );
}
