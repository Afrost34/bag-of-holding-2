import { useId } from 'react';
import type { CharacterDetails, CharacterFile } from '../../app/characters/model';

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
]; // prettier-ignore

const AREAS: { key: keyof CharacterDetails; label: string; hint: string }[] = [
  { key: 'appearance', label: 'Appearance', hint: 'Age, height, eyes, hair, how they dress…' },
  { key: 'personality', label: 'Personality', hint: 'Traits, ideals, bonds and flaws.' },
  { key: 'backstory', label: 'Backstory', hint: 'Where they come from and why they adventure.' },
  { key: 'notes', label: 'Notes', hint: 'Allies, organizations, anything else.' },
];

/** What only the player can write: the person behind the numbers. */
export function DetailsStep({
  character,
  save,
}: {
  character: CharacterFile;
  save: (c: CharacterFile) => void;
}) {
  const id = useId();
  const details = character.details;
  const set = (key: keyof CharacterDetails, value: string) => {
    save({ ...character, details: { ...details, [key]: value } });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-player`} className="mb-1 block text-sm font-medium">
            Player
          </label>
          <input
            id={`${id}-player`}
            value={details.player ?? ''}
            onChange={(e) => {
              set('player', e.target.value);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${id}-alignment`} className="mb-1 block text-sm font-medium">
            Alignment
          </label>
          <select
            id={`${id}-alignment`}
            value={details.alignment ?? ''}
            onChange={(e) => {
              set('alignment', e.target.value);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
          >
            <option value="">—</option>
            {ALIGNMENTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      {AREAS.map((area) => (
        <div key={area.key}>
          <label htmlFor={`${id}-${area.key}`} className="mb-1 block text-sm font-medium">
            {area.label}
          </label>
          <textarea
            id={`${id}-${area.key}`}
            rows={4}
            placeholder={area.hint}
            value={details[area.key] ?? ''}
            onChange={(e) => {
              set(area.key, e.target.value);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base sm:text-sm"
          />
        </div>
      ))}
    </div>
  );
}
