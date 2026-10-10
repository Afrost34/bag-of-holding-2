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
import { RoomPanel } from './RoomPanel';
import { ScatterPanel } from './ScatterPanel';
import { ShapePanel } from './ShapePanel';
import { ToolSettings } from './ToolSettings';

/** The editor's side panel: what the tool draws, then stamps, layers, grid or the picked item. */
export function MapPanels(props: MapPanelsProps) {
  const { open, onClose, selected, tool, mode } = props;
  const creator = mode === 'creator';
  const used = useMemo(() => usedPackRefs(props.doc), [props.doc]);
  const [tab, setTab] = useState<Tab>(creator ? 'stamps' : 'pins');
  // Another tool or tab shows from its top, not from where the last one was scrolled to.
  const scroller = useRef<HTMLDivElement>(null);
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
      className={cn(
        'flex w-80 shrink-0 flex-col border-l border-border bg-surface',
        'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:max-w-[90vw] max-lg:shadow-card',
        !open && 'max-lg:hidden',
      )}
    >
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
        {(tool === 'room' || tool === 'door') && <RoomPanel {...props} />}
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
