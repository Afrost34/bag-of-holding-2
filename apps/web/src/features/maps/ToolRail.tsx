import { cn } from '@boh/ui';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Fragment } from 'react';
import { useRailPrefs } from './railPrefs';
import { GROUP_LABELS, TOOL_GROUP, type Tool, type TOOLS } from './tools';

/** The short name shown on a tool's button when the names are on (its full name is the accessible name). */
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
  scatter: 'Dress',
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
 * The tool column: one column of icons in groups, with the name and key of each in its tooltip
 * (a button at the bottom adds the names). What the active tool does is in the bar under the map.
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
  const { names, toggle } = useRailPrefs();
  // Each group together, in the order of the groups (the tools keep their own order within one).
  const tools = [...unsorted].sort((a, b) => TOOL_GROUP[a.id] - TOOL_GROUP[b.id]);
  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation="vertical"
      className={cn(
        'flex shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-1',
        names ? 'w-36' : 'w-11',
      )}
    >
      {tools.map((t, index) => {
        const group = TOOL_GROUP[t.id];
        const first = index === 0 || group !== TOOL_GROUP[tools[index - 1]?.id ?? t.id];
        return (
          <Fragment key={t.id}>
            {first && index > 0 && (
              <div
                role="separator"
                aria-label={GROUP_LABELS[group]}
                className="my-1 border-t border-border"
              />
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
                'flex h-9 items-center gap-2 rounded-md px-2 text-xs',
                names ? 'justify-start' : 'justify-center',
                tool === t.id
                  ? 'bg-accent text-accent-fg'
                  : 'text-muted hover:bg-sunken hover:text-text',
              )}
            >
              <t.icon className="h-5 w-5 shrink-0" aria-hidden />
              {names && (
                <span className="truncate" aria-hidden>
                  {SHORT[t.id]}
                </span>
              )}
            </button>
          </Fragment>
        );
      })}
      <button
        type="button"
        aria-label={names ? 'Hide the tool names' : 'Show the tool names'}
        title={names ? 'Hide the tool names' : 'Show the tool names'}
        onClick={toggle}
        className="mt-auto flex h-8 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-text"
      >
        {names ? (
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        ) : (
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
