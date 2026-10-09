import type { EntityDetail } from '@boh/data5e';
import { Entries, RichText } from '@boh/renderer';
import { cn } from '@boh/ui';
import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageTools } from '../../../app/annotations/PageTools';
import { EntityMeta } from '../../../app/renderer/EntityCard';
import { ArtImage } from '../../../app/ArtImage';
import { scrollToSection } from './scroll';

export interface TocItem {
  id: string;
  label: string;
  /** 0 = section, 1 = item inside a section. */
  depth: number;
}

/** A long compendium page: contents on the side (wide screens), the article in the middle. */
export function ArticleLayout({ toc, children }: { toc: readonly TocItem[]; children: ReactNode }) {
  return (
    <div
      data-scroll-memory="article"
      className="h-full overflow-y-auto after:block after:h-16 after:content-['']"
    >
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-6 md:px-8 md:py-8">
        <article className="min-w-0 flex-1 text-[15px] leading-relaxed">{children}</article>
        {toc.length > 0 && (
          <nav
            aria-label="On this page"
            className="sticky top-6 hidden max-h-[calc(100vh-8rem)] w-56 shrink-0 self-start overflow-y-auto text-sm xl:block"
          >
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
              On this page
            </p>
            <ul className="space-y-0.5 border-l border-border">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      scrollToSection(item.id);
                    }}
                    className={cn(
                      '-ml-px block w-full truncate border-l border-transparent py-0.5 text-left hover:border-accent hover:text-text',
                      item.depth === 0 ? 'pl-3 font-medium' : 'pl-6 text-muted',
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

function firstImagePath(fluff: EntityDetail | undefined): { path: string; title?: string } | null {
  const images = fluff?.data.images;
  if (!Array.isArray(images)) return null;
  const first: unknown = images[0];
  if (typeof first !== 'object' || first === null) return null;
  const { href, title } = first as { href?: { type?: string; path?: string }; title?: unknown };
  if (href?.type !== 'internal' || !href.path) return null;
  return { path: href.path, ...(typeof title === 'string' ? { title } : {}) };
}

/** 5etools often wraps lore in a section named after the entity; the page title already says it. */
function withoutRepeatedTitle(entries: unknown[], title: string): unknown[] {
  const [first, ...rest] = entries;
  if (typeof first !== 'object' || first === null) return entries;
  const { name, entries: inner } = first as { name?: unknown; entries?: unknown };
  if (!Array.isArray(inner)) return entries;
  // Unwrap an untitled lone wrapper, or a first section titled with the page's own name.
  if ((name === undefined && rest.length === 0) || name === title) {
    return [...(inner as unknown[]), ...rest];
  }
  return entries;
}

/**
 * Title, source and art, then the controls passed as children (e.g. the subclass picker), then
 * the lore in full as the page's description.
 */
export function EntityHero({
  entity,
  fluff,
  tagline = false,
  children,
}: {
  entity: EntityDetail;
  fluff?: EntityDetail | undefined;
  /** Show the art's title as a tagline (class art carries "A Master of All Arms and Armor"). */
  tagline?: boolean;
  children?: ReactNode;
}) {
  const image = firstImagePath(fluff);
  const lore = withoutRepeatedTitle(
    Array.isArray(fluff?.data.entries) ? fluff.data.entries : [],
    entity.name,
  );
  return (
    <header className="mb-6">
      <div className="flex flex-col-reverse gap-5 sm:flex-row">
        <div className="min-w-0 flex-1">
          <h1 className="border-b-2 border-accent pb-1 font-serif text-3xl font-bold">
            <RichText text={entity.name} />
          </h1>
          <EntityMeta entity={entity} className="mt-1.5" />
          <PageTools noteId={entity.key} label={entity.name} />
          {tagline && image?.title && (
            <p className="mt-3 font-serif text-lg italic">{image.title}</p>
          )}
          {children}
          {lore.length > 0 && (
            <div className="mt-3">
              <Entries entries={lore} depth={2} />
            </div>
          )}
        </div>
        {image && (
          <ArtImage
            path={image.path}
            widths={[320, 480, 720]}
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 288px, 100vw"
            className="max-h-[28rem] w-full rounded-lg border border-border object-cover object-top sm:w-72 lg:w-80"
          />
        )}
      </div>
    </header>
  );
}

/** A class or subclass feature: "Level 2: Action Surge" and its text. */
export function FeatureSection({
  id,
  level,
  name,
  entity,
  badge,
  defaultOpen = false,
  children,
}: {
  id: string;
  /** Starts unfolded. */
  defaultOpen?: boolean;
  level: number;
  name: string;
  entity?: EntityDetail | undefined;
  /** Marks features that come from elsewhere, e.g. the chosen subclass. */
  badge?: string;
  children?: ReactNode;
}) {
  // Folded by default so the page reads as a list of features. The contents and the class table
  // open one when they jump to it.
  return (
    <details
      id={id}
      data-feature=""
      open={defaultOpen || undefined}
      className={cn(
        'group mt-3 scroll-mt-4 rounded-lg border bg-surface',
        badge ? 'border-accent/60' : 'border-border',
      )}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-x-2 px-4 py-2.5 font-serif text-lg font-bold select-none hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-muted transition-transform group-open:rotate-90"
          aria-hidden
        />
        <h3 className="min-w-0 flex-1">
          <span className="text-muted">Level {level}: </span>
          <RichText text={name} />
        </h3>
        {badge && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 font-sans text-[11px] font-semibold text-accent-ink">
            {badge}
          </span>
        )}
      </summary>
      <div className="border-t border-border px-4 pt-1 pb-3">
        {entity ? (
          <Entries entries={entity.data.entries} depth={2} />
        ) : (
          <p className="text-muted italic">Not in your data.</p>
        )}
        {children}
      </div>
    </details>
  );
}

/** Opens or folds every feature on the page. */
export function ExpandAllFeatures() {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={() => {
        const next = !open;
        for (const d of document.querySelectorAll<HTMLDetailsElement>('details[data-feature]'))
          d.open = next;
        setOpen(next);
      }}
      className="rounded-md border border-border px-2.5 py-1 font-sans text-sm font-medium hover:border-accent"
    >
      {open ? 'Fold all' : 'Expand all'}
    </button>
  );
}
