import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { RollSpec, TagModel } from '../text/tags';

/**
 * What the renderer needs from the app. The renderer draws 5etools content; the app decides what
 * a link, a roll or an embedded entity does (navigation, hover previews, dice, data loading).
 * Defaults render inert text, so the renderer works in tests and print without an app.
 */
export interface RendererServices {
  EntityLink: ComponentType<{ candidates: string[]; tag: string; children: ReactNode }>;
  RollButton: ComponentType<{ roll: RollSpec; children: ReactNode }>;
  /** Another entity drawn inline (`statblock` entries, class feature references). */
  EmbeddedEntity: ComponentType<{ candidates: string[]; tag: string; name: string }>;
  ReferenceLink: ComponentType<{
    reference: Extract<TagModel, { kind: 'reference' }>;
    children: ReactNode;
  }>;
  /** URL of a 5etools image given its repo-relative path (`bestiary/MM/Goblin.webp`). */
  imageUrl: (path: string) => string;
  /**
   * Rolls and records a roll, resolving to its total (random tables highlight the row it lands
   * on). Null when there is no dice roller, e.g. in print.
   */
  rollDice: ((roll: RollSpec) => Promise<number | null>) | null;
}

const Plain = ({ children }: { children: ReactNode }) => <>{children}</>;

export const defaultServices: RendererServices = {
  EntityLink: Plain,
  RollButton: Plain,
  EmbeddedEntity: ({ name }) => <p className="text-muted italic">{name}</p>,
  ReferenceLink: Plain,
  imageUrl: (path) => path,
  rollDice: null,
};

const ServicesContext = createContext<RendererServices>(defaultServices);

export function RendererProvider({
  services,
  children,
}: {
  services: Partial<RendererServices>;
  children: ReactNode;
}) {
  const parent = useContext(ServicesContext);
  return (
    <ServicesContext.Provider value={{ ...parent, ...services }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): RendererServices {
  return useContext(ServicesContext);
}

/** The name of the block being rendered (an action, a feature), used to label rolls inside it. */
const RollLabelContext = createContext<string | undefined>(undefined);

export function RollLabel({ label, children }: { label: string | undefined; children: ReactNode }) {
  const parent = useContext(RollLabelContext);
  return <RollLabelContext.Provider value={label ?? parent}>{children}</RollLabelContext.Provider>;
}

export function useRollLabel(): string | undefined {
  return useContext(RollLabelContext);
}
