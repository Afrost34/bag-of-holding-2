import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EmbedHost } from './editor/livePreview';

let nextId = 0;
const ids = new WeakMap<HTMLElement, number>();

/**
 * Lets CodeMirror widgets show React content: the editor mounts elements through `host`, and
 * `portals(render)` draws into each of them (so the content keeps the app's context).
 */
export function useEmbedHost(): {
  host: EmbedHost;
  portals: (render: (inner: string) => ReactNode) => ReactNode[];
} {
  const [mounted, setMounted] = useState<ReadonlyMap<HTMLElement, string>>(new Map());
  const host = useMemo<EmbedHost>(
    () => ({
      mount: (el, inner) => {
        ids.set(el, nextId++);
        setMounted((m) => new Map(m).set(el, inner));
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
      [...mounted].map(([el, inner]) => createPortal(render(inner), el, String(ids.get(el)))),
  };
}
