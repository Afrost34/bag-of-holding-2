import { Entries, RendererProvider, RichText, type RendererServices } from '@boh/renderer';
import * as HoverCard from '@radix-ui/react-hover-card';
import * as Popover from '@radix-ui/react-popover';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AppLink } from '../AppLink';
import { entityPath, useEntity, useResolvedLink } from '../data/entities';
import { RollChip } from '../dice/RollChip';
import { useDice } from '../dice/store';
import { EntityCard } from './EntityCard';
import { referencePath } from './referenceTarget';

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
  return <ResolvedEntityLink entityKey={state.key}>{children}</ResolvedEntityLink>;
}

const PREVIEW_CLASS =
  'z-50 max-h-[min(60vh,32rem)] w-[min(92vw,26rem)] overflow-y-auto rounded-lg shadow-card';

/**
 * A link with a preview: on hover with a mouse; on a touch screen the first tap opens the
 * preview (with "Open page"), since there is no hover, and a second tap follows the link.
 */
function ResolvedEntityLink({ entityKey, children }: { entityKey: string; children: ReactNode }) {
  const [tapOpen, setTapOpen] = useState(false);
  const lastPointer = useRef<string>('mouse');
  const path = entityPath(entityKey);
  return (
    <Popover.Root open={tapOpen} onOpenChange={setTapOpen}>
      <HoverCard.Root openDelay={350} closeDelay={120}>
        <Popover.Anchor asChild>
          <HoverCard.Trigger asChild>
            <AppLink
              to={path}
              onPointerDown={(e) => {
                lastPointer.current = e.pointerType;
              }}
              onClick={(e) => {
                if (lastPointer.current === 'touch' && !tapOpen) {
                  e.preventDefault();
                  setTapOpen(true);
                }
              }}
              className="font-medium text-link hover:underline"
            >
              {children}
            </AppLink>
          </HoverCard.Trigger>
        </Popover.Anchor>
        <HoverCard.Portal>
          <HoverCard.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className={PREVIEW_CLASS}
          >
            <Preview entityKey={entityKey} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Preview"
          className={PREVIEW_CLASS}
        >
          <Preview entityKey={entityKey} />
          <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-lg border-t border-border bg-surface p-2">
            <button
              type="button"
              onClick={() => {
                setTapOpen(false);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-text"
            >
              Close
            </button>
            <AppLink
              to={path}
              onNavigate={() => {
                setTapOpen(false);
              }}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
            >
              Open page
            </AppLink>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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

const INLINE_TYPES = new Set(['classFeature', 'subclassFeature', 'optionalfeature']);

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
  // Features and options read as part of the text around them, not as separate cards.
  if (INLINE_TYPES.has(entity.entity.type)) {
    return (
      <section className="my-3">
        <h4 className="font-serif font-bold">
          <RichText text={name || entity.entity.name} />
        </h4>
        <Entries entries={entity.entity.data.entries} depth={3} />
      </section>
    );
  }
  return <EntityCard entity={entity.entity} />;
}

function ReferenceLink({ reference, children }: ComponentProps<RendererServices['ReferenceLink']>) {
  const path = referencePath(reference.ref, reference.args);
  if (!path) return <span>{children}</span>;
  return (
    <AppLink to={path} className="font-medium text-link hover:underline">
      {children}
    </AppLink>
  );
}

const services: Partial<RendererServices> = {
  EntityLink,
  RollButton: RollChip,
  EmbeddedEntity,
  ReferenceLink,
  imageUrl: (path) => `${IMAGE_BASE}${path.split('/').map(encodeURIComponent).join('/')}`,
  rollDice: async (roll) => (await useDice.getState().roll(roll))?.total ?? null,
};

export function AppRendererProvider({ children }: { children: ReactNode }) {
  return <RendererProvider services={services}>{children}</RendererProvider>;
}
