/** The fog of the Viewer: areas the players cannot see until the DM reveals them. */
import { Button, cn } from '@boh/ui';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { addFog, rectPoints, removeFog, setFogRevealed } from '../../app/maps/model';
import { IconButton, Section } from './PanelParts';
import { type MapPanelsProps } from './panelTypes';

const choice = (on: boolean) =>
  cn(
    'rounded-md border px-2 py-1.5 text-sm',
    on ? 'border-accent bg-accent-soft font-medium' : 'border-border text-muted hover:bg-sunken',
  );

export function FogPanel({ doc, commit, fog, setFog }: MapPanelsProps) {
  const areas = doc.reveal ?? [];
  return (
    <Section title="Fog">
      <p className="text-xs text-muted">
        Fog is black for the players and faint for you. Draw fog to hide a place, or reveal to cut a
        hole in it; they see changes at once in the player window.
      </p>
      <div role="radiogroup" aria-label="Fog action" className="grid grid-cols-2 gap-2">
        {(
          [
            ['hide', 'Hide', EyeOff],
            ['reveal', 'Reveal', Eye],
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={fog.mode === mode}
            onClick={() => {
              setFog({ ...fog, mode });
            }}
            className={cn(choice(fog.mode === mode), 'flex items-center justify-center gap-1.5')}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Fog shape" className="grid grid-cols-2 gap-2">
        {(
          [
            ['rect', 'Rectangle (drag)'],
            ['polygon', 'Outline (click)'],
          ] as const
        ).map(([shape, label]) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={fog.shape === shape}
            onClick={() => {
              setFog({ ...fog, shape });
            }}
            className={choice(fog.shape === shape)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            commit((d) => addFog(d, rectPoints(0, 0, d.width, d.height)));
          }}
        >
          Cover the whole map
        </Button>
        <Button
          variant="ghost"
          disabled={areas.length === 0}
          onClick={() => {
            commit((d) => {
              const { reveal: _r, ...rest } = d;
              return rest;
            });
          }}
        >
          Clear all fog
        </Button>
      </div>
      {areas.length > 0 && (
        <ol aria-label="Fog areas" className="space-y-1">
          {areas.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {a.revealed ? 'Revealed' : 'Hidden'} area {i + 1}
              </span>
              <IconButton
                label={
                  a.revealed ? `Hide fog area ${String(i + 1)}` : `Reveal fog area ${String(i + 1)}`
                }
                onClick={() => {
                  commit((d) => setFogRevealed(d, a.id, !a.revealed));
                }}
              >
                {a.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </IconButton>
              <IconButton
                label={`Delete fog area ${String(i + 1)}`}
                onClick={() => {
                  commit((d) => removeFog(d, a.id));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
