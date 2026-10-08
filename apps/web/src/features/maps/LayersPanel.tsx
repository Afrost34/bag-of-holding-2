/** The Layers panel of the map maker. */
import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { addLayer, moveLayer, removeLayer, updateLayer } from '../../app/maps/model';
import { IconButton, Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';

export function Layers({ doc, commit, layerId, setLayerId }: MapPanelsProps) {
  return (
    <Section title="Layers">
      <p className="text-xs text-muted">
        New things go on the chosen layer. The top one is drawn last.
      </p>
      <ol className="space-y-1">
        {[...doc.layers].reverse().map((l) => (
          <li
            key={l.id}
            className={cn(
              'flex items-center gap-1 rounded-md border px-1.5 py-1',
              l.id === layerId ? 'border-accent bg-accent-soft' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="active-layer"
              checked={l.id === layerId}
              aria-label={`Draw on ${l.name}`}
              onChange={() => {
                setLayerId(l.id);
              }}
            />
            <input
              value={l.name}
              aria-label="Layer name"
              onChange={(e) => {
                commit((d) => updateLayer(d, l.id, { name: e.target.value }));
              }}
              className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
            />
            <span className="text-xs text-muted">{l.items.length}</span>
            <IconButton
              label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
              onClick={() => {
                commit((d) => updateLayer(d, l.id, { visible: !l.visible }));
              }}
            >
              {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
              onClick={() => {
                commit((d) => updateLayer(d, l.id, { locked: !l.locked }));
              }}
            >
              {l.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label={`Move ${l.name} up`}
              onClick={() => {
                commit((d) => moveLayer(d, l.id, 1));
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Move ${l.name} down`}
              onClick={() => {
                commit((d) => moveLayer(d, l.id, -1));
              }}
            >
              <ArrowDown className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Delete ${l.name}`}
              disabled={doc.layers.length <= 1}
              onClick={() => {
                commit((d) => removeLayer(d, l.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        onClick={() => {
          commit((d) => addLayer(d, `Layer ${String(d.layers.length + 1)}`));
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a layer
      </Button>
    </Section>
  );
}
