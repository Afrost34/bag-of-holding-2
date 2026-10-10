import { cn } from '@boh/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { ItemSettings } from './ItemSettings';
import { FogPanel } from './FogPanel';
import { Layers } from './LayersPanel';
import { MapSettings } from './MapSettings';
import { type MapPanelsProps, type Tab } from './panelTypes';
import { PinCategories } from './PinPanels';
import { StampLibrary } from './StampLibrary';
import { BuildingPanel, DistrictPanel } from './CityPanel';
import { ScatterPanel } from './ScatterPanel';
import { ShapePanel } from './ShapePanel';
import { ToolSettings } from './ToolSettings';

/** The editor's side panel: what the tool draws, then stamps, layers, grid or the picked item. */
export function MapPanels(props: MapPanelsProps) {
  const { open, onClose, selected, tool, mode } = props;
  const creator = mode === 'creator';
  const [tab, setTab] = useState<Tab>(creator ? 'stamps' : 'pins');
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {(tool === 'pen' || tool === 'terrain' || tool === 'eraser' || tool === 'template') && (
          <ToolSettings {...props} />
        )}
        {tool === 'fog' && <FogPanel {...props} />}
        {(tool === 'area' || tool === 'path') && <ShapePanel {...props} />}
        {tool === 'scatter' && <ScatterPanel {...props} />}
        {tool === 'district' && <DistrictPanel {...props} />}
        {tool === 'building' && <BuildingPanel {...props} />}
        {tab === 'stamps' && <StampLibrary selected={props.stamp} onPick={props.setStamp} />}
        {tab === 'layers' && <Layers {...props} />}
        {tab === 'pins' && <PinCategories doc={props.doc} commit={props.commit} />}
        {tab === 'grid' && <MapSettings {...props} />}
        {tab === 'item' && selected && <ItemSettings {...props} item={selected} />}
      </div>
    </aside>
  );
}
