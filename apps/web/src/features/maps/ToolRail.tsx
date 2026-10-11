import { cn } from '@boh/ui';
import { Fragment } from 'react';
import { GROUP_LABELS, TOOL_GROUP, TOOL_HINTS, type Tool, type TOOLS } from './tools';

/** The short name shown on a tool's button (its full name is the accessible name). */
const SHORT: Record<Tool, string> = {
  select: 'Select',
  pan: 'Pan',
  stamp: 'Objects',
  pen: 'Brush',
  terrain: 'Terrain',
  eraser: 'Eraser',
  area: 'Shape',
  path: 'Path',
  elevation: 'Height',
  scatter: 'Scatter',
  district: 'District',
  building: 'Building',
  room: 'Room',
  door: 'Portal',
  wall: 'Wall',
  light: 'Light',
  text: 'Text',
  measure: 'Ruler',
  calibrate: 'Grid',
  template: 'Template',
  pin: 'Pin',
  route: 'Route',
  fog: 'Fog',
};

/**
 * Dungeondraft's tool column: the tools in labelled groups (Select, Terrain, Design, Objects,
 * Effects…), two to a row with their icon and name, and the active tool's hint at the bottom.
 * On a phone it shrinks to a column of icons.
 */
export function ToolRail({
  tools: unsorted,
  tool,
  onPick,
}: {
  tools: typeof TOOLS;
  tool: Tool;
  onPick: (t: Tool) => void;
}) {
  // Each group together, in the order of the groups (the tools keep their own order within one).
  const tools = [...unsorted].sort((a, b) => TOOL_GROUP[a.id] - TOOL_GROUP[b.id]);
  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface p-1 md:w-52 md:p-2"
    >
      <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
        {tools.map((t, index) => {
          const group = TOOL_GROUP[t.id];
          const first = index === 0 || group !== TOOL_GROUP[tools[index - 1]?.id ?? t.id];
          return (
            <Fragment key={t.id}>
              {first && (
                <div
                  role="separator"
                  aria-label={GROUP_LABELS[group]}
                  className="mt-1.5 border-t border-border pt-1 text-[10px] font-semibold tracking-wide text-muted uppercase first:mt-0 first:border-t-0 first:pt-0 md:col-span-2"
                >
                  <span className="hidden md:inline">{GROUP_LABELS[group]}</span>
                  <span className="text-[9px] md:hidden">{GROUP_LABELS[group]}</span>
                </div>
              )}
              <button
                type="button"
                aria-label={t.label}
                aria-pressed={tool === t.id}
                title={`${t.label} (${t.key.toUpperCase()})`}
                onClick={() => {
                  onPick(t.id);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md p-2 text-xs md:justify-start md:px-2 md:py-1.5',
                  tool === t.id
                    ? 'bg-accent text-accent-fg'
                    : 'text-muted hover:bg-sunken hover:text-text',
                )}
              >
                <t.icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden />
                <span className="hidden truncate md:inline" aria-hidden>
                  {SHORT[t.id]}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <p className="mt-auto hidden border-t border-border pt-2 text-[11px] leading-snug text-muted md:block">
        <span className="font-semibold text-text">{tools.find((t) => t.id === tool)?.label}.</span>{' '}
        {TOOL_HINTS[tool]}
      </p>
    </div>
  );
}
