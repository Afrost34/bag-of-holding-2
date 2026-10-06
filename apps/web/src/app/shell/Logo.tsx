import type { SVGProps } from 'react';

/** The bag mark. Uses fixed brand colours so it reads on the dark sidebar in both themes. */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path d="M21 11c4 4.5 18 4.5 22 0l-4.5 10h-13z" fill="#e5484d" />
      <path d="M24 25c-9 6-13.5 17-9 25 3.5 6 30.5 6 34 0 4.5-8 0-19-9-25z" fill="#c53131" />
      <rect x="22" y="20.5" width="20" height="5" rx="2.5" fill="#e0b04a" />
      <path d="M32 33l2.2 5.8L40 41l-5.8 2.2L32 49l-2.2-5.8L24 41l5.8-2.2z" fill="#fde9c4" />
    </svg>
  );
}
