/** The Layers panel of the map maker: variants (what is shown), then the layers. */
import { Button, cn } from '@boh/ui';
import { ArrowDown, ArrowUp, Eye, EyeOff, Image, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { importBackground, saveThumbnail } from '../../app/maps/assets';
import {
  activeVariant,
  addLayer,
  addPictureLayer,
  addVariant,
  layerShown,
  moveLayer,
  removeLayer,
  removeVariant,
  setActiveVariant,
  setLayerShown,
  updateLayer,
  updateVariant,
} from '../../app/maps/model';
import { IconButton, PictureFile, Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';

/**
 * Variants: named sets of what is shown (a night version, another floor, the players' view of
 * the same map). Showing or hiding a layer while one is active changes that variant only.
 */
function Variants({ doc, commit }: Pick<MapPanelsProps, 'doc' | 'commit'>) {
  const variants = doc.variants ?? [];
  const current = activeVariant(doc);
  return (
    <Section title="Variants">
      <p className="text-xs text-muted">
        Each remembers which layers and pins are shown. Pick one to switch the map to it.
      </p>
      {variants.length > 0 && (
        <ul aria-label="Variants" className="space-y-1">
          {variants.map((v) => (
            <li
              key={v.id}
              className={cn(
                'flex items-center gap-1 rounded-md border px-1.5 py-1',
                v.id === doc.activeVariant ? 'border-accent bg-accent-soft' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="active-variant"
                checked={v.id === doc.activeVariant}
                aria-label={`Show ${v.name}`}
                onChange={() => {
                  commit((d) => setActiveVariant(d, v.id));
                }}
              />
              <input
                value={v.name}
                aria-label="Variant name"
                onChange={(e) => {
                  commit((d) => updateVariant(d, v.id, (x) => ({ ...x, name: e.target.value })));
                }}
                className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
              />
              <IconButton
                label={`Delete ${v.name}`}
                onClick={() => {
                  commit((d) => removeVariant(d, v.id));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            commit((d) => addVariant(d, ''));
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New variant
        </Button>
        {current && (
          <Button
            variant="ghost"
            onClick={() => {
              commit((d) => setActiveVariant(d, undefined));
            }}
          >
            Show every layer as set
          </Button>
        )}
      </div>
    </Section>
  );
}

export function Layers(props: MapPanelsProps) {
  const { doc, commit, layerId, setLayerId, mode } = props;
  const [importing, setImporting] = useState(false);
  const addPicture = (file: File) => {
    setImporting(true);
    void importBackground(file, doc.campaign)
      .then((pic) => {
        const first = !doc.layers.some((l) => l.picture);
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        commit((d) => addPictureLayer(d, name, pic));
        // The maps list shows the first picture small.
        if (first) void saveThumbnail(file, doc.id, doc.campaign);
      })
      .finally(() => {
        setImporting(false);
      });
  };
  return (
    <>
      <Variants doc={doc} commit={commit} />
      <Section title="Layers">
        <p className="text-xs text-muted">
          New things go on the chosen layer. The top one is drawn last.
          {doc.activeVariant ? ' Showing and hiding changes the active variant.' : ''}
        </p>
        <ol className="space-y-1">
          {[...doc.layers].reverse().map((l) => {
            const shown = layerShown(doc, l);
            return (
              <li
                key={l.id}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-1.5 py-1',
                  l.id === layerId ? 'border-accent bg-accent-soft' : 'border-border',
                )}
              >
                {l.picture ? (
                  <Image className="h-4 w-4 shrink-0 text-muted" aria-label="Picture layer" />
                ) : (
                  <input
                    type="radio"
                    name="active-layer"
                    checked={l.id === layerId}
                    aria-label={`Draw on ${l.name}`}
                    onChange={() => {
                      setLayerId(l.id);
                    }}
                  />
                )}
                <input
                  value={l.name}
                  aria-label="Layer name"
                  onChange={(e) => {
                    commit((d) => updateLayer(d, l.id, { name: e.target.value }));
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                />
                {!l.picture && <span className="text-xs text-muted">{l.items.length}</span>}
                <IconButton
                  label={shown ? `Hide ${l.name}` : `Show ${l.name}`}
                  onClick={() => {
                    commit((d) => setLayerShown(d, l.id, !shown));
                  }}
                >
                  {shown ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </IconButton>
                {mode === 'creator' && (
                  <>
                    {!l.picture && (
                      <IconButton
                        label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
                        onClick={() => {
                          commit((d) => updateLayer(d, l.id, { locked: !l.locked }));
                        }}
                      >
                        {l.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                      </IconButton>
                    )}
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
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {mode === 'creator' && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              onClick={() => {
                commit((d) => addLayer(d, `Layer ${String(d.layers.length + 1)}`));
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add a layer
            </Button>
            <PictureFile label="Add a picture layer" busy={importing} onFile={addPicture} />
            <p className="text-xs text-muted">
              A picture layer shows an image: the base map, a night version, an overlay. The first
              sizes the map to it.
            </p>
          </div>
        )}
      </Section>
    </>
  );
}
