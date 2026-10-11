import { cn } from '@boh/ui';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usedPackRefs } from '../../app/maps/packUse';
import { ArrangePanel } from './ArrangePanel';
import { ItemSettings } from './ItemSettings';
import { ElevationPanel } from './ElevationPanel';
import { FogPanel } from './FogPanel';
import { Layers } from './LayersPanel';
import { LightPanel } from './LightPanel';
import { MapSettings } from './MapSettings';
import { type MapPanelsProps, type Tab } from './panelTypes';
import { PinCategories } from './PinPanels';
import { StampLibrary } from './StampLibrary';
import { BuildingPanel, DistrictPanel } from './CityPanel';
import { WallPanel } from './WallStrips';
import { PortalPanel } from './PortalPanel';
import { RoomPanel } from './RoomPanel';
import { ScatterPanel } from './ScatterPanel';
import { ShapePanel } from './ShapePanel';
import { ToolSettings } from './ToolSettings';

/** The editor's side panel: what the tool draws, then stamps, layers, grid or the picked item. */
const WIDTH_KEY = 'boh.map.panel-width';
const clampWidth = (w: number) => Math.min(640, Math.max(260, Math.round(w)));
function readWidth(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    return stored > 0 ? clampWidth(stored) : 340;
  } catch {
    return 340;
  }
}
function saveWidth(w: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(w));
  } catch {
    /* a private window: the width lasts until the page closes */
  }
}

export function MapPanels(props: MapPanelsProps) {
  const { open, onClose, selected, tool, mode } = props;
  const creator = mode === 'creator';
  const used = useMemo(() => usedPackRefs(props.doc), [props.doc]);
  const [tab, setTab] = useState<Tab>(creator ? 'stamps' : 'pins');
  // Another tool or tab shows from its top, not from where the last one was scrolled to.
  const scroller = useRef<HTMLDivElement>(null);
  // The panel's width, dragged by its left edge and kept on this device.
  const [width, setWidth] = useState(readWidth);
  const drag = useRef<{ x: number; width: number } | null>(null);
  // Tools with settings of their own do not also show the stamp library under them (Scatter keeps
  // it, to add a stamp to the mix).
  const ownsPanel = ![
    'stamp',
    'select',
    'pan',
    'text',
    'measure',
    'scatter',
    'wall',
    'pin',
    'route',
  ].includes(tool);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tool, tab]);
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Picking an item shows its settings.
  if ((selected?.id ?? null) !== shownFor) {
    setShownFor(selected?.id ?? null);
    if (selected) setTab('item');
    else if (tab === 'item') setTab(creator ? 'stamps' : 'pins');
  }
  const tabs: { id: Tab; label: string }[] = [
    ...(creator ? [{ id: 'stamps' as const, label: 'Stamps' }] : []),
    { id: 'layers', label: 'Layers' },
    ...(creator ? [] : [{ id: 'pins' as const, label: 'Pins' }]),
    { id: 'grid', label: 'Map' },
    ...(selected ? [{ id: 'item' as const, label: 'Item' }] : []),
  ];
  return (
    <aside
      aria-label="Map panels"
      style={{ width }}
      className={cn(
        'relative flex shrink-0 flex-col border-l border-border bg-surface',
        'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:max-w-[90vw] max-lg:shadow-card',
        !open && 'max-lg:hidden',
      )}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panel"
        aria-valuenow={width}
        aria-valuemin={260}
        aria-valuemax={640}
        tabIndex={0}
        title="Drag to resize the panel"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, width };
        }}
        onPointerMove={(e) => {
          if (drag.current) setWidth(clampWidth(drag.current.width + drag.current.x - e.clientX));
        }}
        onPointerUp={() => {
          drag.current = null;
          saveWidth(width);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const next = clampWidth(width + (e.key === 'ArrowLeft' ? 24 : -24));
            setWidth(next);
            saveWidth(next);
          }
        }}
        className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize hover:bg-accent/30 focus-visible:bg-accent/40 lg:block"
      />
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
        <div role="tablist" aria-label="Panels" className="flex flex-1 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
              }}
              className={cn(
                'rounded-t-md px-2.5 py-1.5 text-sm font-medium',
                tab === t.id ? 'bg-sunken text-text' : 'text-muted hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close panels"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-sunken lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {props.selectedIds.length > 1 && <ArrangePanel {...props} />}
        {(tool === 'pen' || tool === 'terrain' || tool === 'eraser' || tool === 'template') && (
          <ToolSettings {...props} />
        )}
        {tool === 'fog' && <FogPanel {...props} />}
        {tool === 'light' && <LightPanel {...props} />}
        {(tool === 'area' || tool === 'path') && <ShapePanel {...props} />}
        {tool === 'scatter' && <ScatterPanel {...props} />}
        {tool === 'elevation' && <ElevationPanel {...props} />}
        {tool === 'district' && <DistrictPanel {...props} />}
        {tool === 'room' && <RoomPanel {...props} />}
        {tool === 'door' && <PortalPanel {...props} />}
        {tool === 'building' && <BuildingPanel {...props} />}
        {tool === 'wall' && <WallPanel {...props} />}
        {tab === 'stamps' && !ownsPanel && (
          <StampLibrary
            selected={props.stamp}
            onPick={props.setStamp}
            onUseAsMix={props.onScatterMix}
            used={used}
          />
        )}
        {tab === 'stamps' && ownsPanel && (
          <p className="text-xs text-muted">The stamp library is here when the Stamp tool is on.</p>
        )}
        {tab === 'layers' && <Layers {...props} />}
        {tab === 'pins' && <PinCategories doc={props.doc} commit={props.commit} />}
        {tab === 'grid' && <MapSettings {...props} />}
        {tab === 'item' && selected && <ItemSettings {...props} item={selected} />}
      </div>
    </aside>
  );
}
