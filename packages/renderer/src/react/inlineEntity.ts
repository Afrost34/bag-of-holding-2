import type { ComponentType } from 'react';

/**
 * Entries can embed whole entities (`statblockInline`), and entity views render entries. To keep
 * the modules acyclic, the entity view registers itself here and `Entries` looks it up.
 */
export interface InlineEntityProps {
  type: string;
  data: Record<string, unknown>;
}

let component: ComponentType<InlineEntityProps> | null = null;

export function registerInlineEntity(view: ComponentType<InlineEntityProps>): void {
  component = view;
}

export function inlineEntityView(): ComponentType<InlineEntityProps> | null {
  return component;
}
