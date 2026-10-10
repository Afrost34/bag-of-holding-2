/** The settings of the current map maker tool (stamps, brushes, eraser, templates). */
import { cn } from '@boh/ui';
import { useMemo } from 'react';
import { type TemplateShape } from '../../app/maps/model';
import { TERRAINS, terrainTile } from '../../app/maps/terrain';
import { PackTextures } from './PackTextures';
import { Section } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';
import { PEN_COLORS } from './tools';

export function ToolSettings({
  tool,
  brush,
  setBrush,
  terrain,
  setTerrain,
  eraser,
  setEraser,
  template,
  setTemplate,
}: MapPanelsProps) {
  if (tool === 'eraser')
    return (
      <Section title="Eraser">
        <label className="block text-sm">
          Width: {eraser}
          <input
            type="range"
            min={10}
            max={400}
            value={eraser}
            onChange={(e) => {
              setEraser(Number(e.target.value));
            }}
            className="w-full"
          />
        </label>
        <p className="text-xs text-muted">
          Rubs out brush and terrain strokes where it goes, on layers that are shown and not locked.
          Undo brings them back.
        </p>
      </Section>
    );
  if (tool === 'template')
    return (
      <Section title="Template to draw">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            Shape
            <select
              value={template.shape}
              onChange={(e) => {
                setTemplate({ ...template, shape: e.target.value as TemplateShape });
              }}
              className={field}
            >
              <option value="cone">Cone</option>
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label className="text-sm">
            Size (ft)
            <input
              type="number"
              min={5}
              step={5}
              value={template.feet}
              onChange={(e) => {
                setTemplate({ ...template, feet: Math.max(5, Number(e.target.value) || 5) });
              }}
              className={field}
            />
          </label>
        </div>
        <p className="text-xs text-muted">Drag from where it starts towards where it points.</p>
      </Section>
    );
  const terrainTool = tool === 'terrain';
  const s = terrainTool ? terrain : brush;
  const set = terrainTool ? setTerrain : setBrush;
  return (
    <Section title={terrainTool ? 'Terrain brush' : 'Brush'}>
      {terrainTool ? (
        <>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Terrain">
            {TERRAINS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={s.texture === t.id}
                onClick={() => {
                  set({ ...s, texture: t.id, color: t.base });
                }}
                className={cn(
                  'overflow-hidden rounded-md border-2 text-left text-xs',
                  s.texture === t.id ? 'border-accent' : 'border-border',
                )}
              >
                <TerrainSwatch id={t.id} />
                <span className="block truncate px-1 py-0.5">{t.name}</span>
              </button>
            ))}
          </div>
          <PackTextures
            value={s.texture}
            onPick={(texture) => {
              set({ ...s, texture, color: '#9a958d' });
            }}
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Colour">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={s.color === c}
              aria-label={c}
              title={c}
              onClick={() => {
                set({ ...s, color: c });
              }}
              className={cn(
                'h-7 w-7 rounded-full border-2',
                s.color === c ? 'border-accent' : 'border-border',
              )}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            aria-label="Another colour"
            value={s.color}
            onChange={(e) => {
              set({ ...s, color: e.target.value });
            }}
            className="h-7 w-9 cursor-pointer rounded border border-border bg-surface"
          />
        </div>
      )}
      <label className="block text-sm">
        Width: {s.width}
        <input
          type="range"
          min={terrainTool ? 20 : 1}
          max={terrainTool ? 400 : 40}
          value={s.width}
          onChange={(e) => {
            set({ ...s, width: Number(e.target.value) });
          }}
          className="w-full"
        />
      </label>
      {terrainTool && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.border === true}
            onChange={(e) => {
              const { border: _b, ...rest } = s;
              set(e.target.checked ? { ...rest, border: true } : rest);
            }}
          />
          Border (a material: rock, lava, ice)
        </label>
      )}
      {terrainTool && (
        <label className="block text-sm">
          Soft edge: {Math.round((s.soft ?? 0) * 100)}%
          <input
            type="range"
            aria-label="Soft edge"
            min={0}
            max={100}
            value={Math.round((s.soft ?? 0) * 100)}
            onChange={(e) => {
              set({ ...s, soft: Number(e.target.value) / 100 });
            }}
            className="w-full"
          />
        </label>
      )}
      <label className="block text-sm">
        Opacity: {Math.round(s.opacity * 100)}%
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(s.opacity * 100)}
          onChange={(e) => {
            set({ ...s, opacity: Number(e.target.value) / 100 });
          }}
          className="w-full"
        />
      </label>
    </Section>
  );
}

/** A terrain texture's look, for its button. */
export function TerrainSwatch({ id }: { id: (typeof TERRAINS)[number]['id'] }) {
  const url = useMemo(() => terrainTile(id).toDataURL('image/png'), [id]);
  return (
    <span
      aria-hidden
      className="block h-8 w-full bg-cover"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}
