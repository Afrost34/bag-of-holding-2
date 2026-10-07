import type { EntityDetail } from '@boh/data5e';
import { Entries, RichText } from '@boh/renderer';
import { cn } from '@boh/ui';
import type { ReactNode } from 'react';
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
    <div className="h-full overflow-y-auto">
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
            sizes="(min-width: 640px) 224px, 100vw"
            className="max-h-72 w-full rounded-lg border border-border object-cover object-top sm:w-56"
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
  children,
}: {
  id: string;
  level: number;
  name: string;
  entity?: EntityDetail | undefined;
  /** Marks features that come from elsewhere, e.g. the chosen subclass. */
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={cn('mt-6 scroll-mt-4', badge && 'border-l-2 border-accent pl-4')}>
      <h3 className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg font-bold">
        <span>
          <span className="text-muted">Level {level}: </span>
          <RichText text={name} />
        </span>
        {badge && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 font-sans text-[11px] font-semibold text-accent">
            {badge}
          </span>
        )}
      </h3>
      {entity ? (
        <Entries entries={entity.data.entries} depth={2} />
      ) : (
        <p className="text-muted italic">Not in your data.</p>
      )}
      {children}
    </section>
  );
}
