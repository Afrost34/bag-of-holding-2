import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Embed, EmbedHost } from './editor/livePreview';

let nextId = 0;
const ids = new WeakMap<HTMLElement, number>();

/**
 * Lets CodeMirror widgets show React content: the editor mounts elements through `host`, and
 * `portals(render)` draws into each of them (so the content keeps the app's context).
 */
export function useEmbedHost(): {
  host: EmbedHost;
  portals: (render: (embed: Embed) => ReactNode) => ReactNode[];
} {
  const [mounted, setMounted] = useState<ReadonlyMap<HTMLElement, Embed>>(new Map());
  const host = useMemo<EmbedHost>(
    () => ({
      mount: (el, embed) => {
        ids.set(el, nextId++);
        setMounted((m) => new Map(m).set(el, embed));
      },
      unmount: (el) => {
        setMounted((m) => {
          if (!m.has(el)) return m;
          const next = new Map(m);
          next.delete(el);
          return next;
        });
      },
    }),
    [],
  );
  return {
    host,
    portals: (render) =>
      [...mounted].map(([el, embed]) => createPortal(render(embed), el, String(ids.get(el)))),
  };
}
