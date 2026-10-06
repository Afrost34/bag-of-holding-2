import { RendererProvider, type RendererServices } from '@boh/renderer';
import * as HoverCard from '@radix-ui/react-hover-card';
import type { ComponentProps, ReactNode } from 'react';
import { AppLink } from '../AppLink';
import { entityPath, useEntity, useResolvedLink } from '../data/entities';
import { RollChip } from '../dice/RollChip';
import { EntityCard } from './EntityCard';

/** 5etools images, fetched on demand and cached by the service worker. */
export const IMAGE_BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/';

function EntityLink({
  candidates,
  children,
}: {
  candidates: string[];
  tag: string;
  children: ReactNode;
}) {
  const state = useResolvedLink(candidates);
  if (state.status !== 'found') {
    return (
      <span
        className={
          state.status === 'missing'
            ? 'text-muted underline decoration-dotted underline-offset-2'
            : undefined
        }
        title={
          state.status === 'missing'
            ? 'Not in your data (or its source is not downloaded)'
            : undefined
        }
      >
        {children}
      </span>
    );
  }
  return (
    <HoverCard.Root openDelay={350} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <AppLink to={entityPath(state.key)} className="font-medium text-link hover:underline">
          {children}
        </AppLink>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-[min(60vh,32rem)] w-[min(92vw,26rem)] overflow-y-auto rounded-lg shadow-card"
        >
          <Preview entityKey={state.key} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function Preview({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        Loading…
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        Not found.
      </div>
    );
  }
  return (
    <div className="text-sm">
      <EntityCard entity={state.entity} compact />
    </div>
  );
}

function EmbeddedEntity({ candidates, name }: { candidates: string[]; tag: string; name: string }) {
  const resolved = useResolvedLink(candidates);
  const entity = useEntity(resolved.status === 'found' ? resolved.key : null);
  if (
    resolved.status === 'missing' ||
    (resolved.status === 'found' && entity.status === 'missing')
  ) {
    return <p className="text-muted italic">{name} (not in your data)</p>;
  }
  if (entity.status !== 'found') return <p className="text-muted">Loading {name}…</p>;
  return <EntityCard entity={entity.entity} />;
}

function ReferenceLink({ children }: ComponentProps<RendererServices['ReferenceLink']>) {
  // Book chapters, adventure areas, quick-reference and filtered lists arrive with the compendium (M3).
  return (
    <span
      className="underline decoration-dotted underline-offset-2"
      title="Book and adventure links arrive with the compendium"
    >
      {children}
    </span>
  );
}

const services: Partial<RendererServices> = {
  EntityLink,
  RollButton: RollChip,
  EmbeddedEntity,
  ReferenceLink,
  imageUrl: (path) => `${IMAGE_BASE}${path.split('/').map(encodeURIComponent).join('/')}`,
};

export function AppRendererProvider({ children }: { children: ReactNode }) {
  return <RendererProvider services={services}>{children}</RendererProvider>;
}
