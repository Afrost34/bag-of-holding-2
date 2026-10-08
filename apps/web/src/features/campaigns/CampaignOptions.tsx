import { cn } from '@boh/ui';
import { useId } from 'react';
import {
  EDITION_LABELS,
  type CampaignEdition,
  type CampaignRules,
} from '../../app/campaigns/model';

const EDITIONS: { id: CampaignEdition; hint: string }[] = [
  { id: '2024', hint: 'Links without a source, the builder and encounters use 2024 versions.' },
  { id: '2014', hint: 'They use 2014 versions.' },
  { id: 'mixed', hint: 'Choose per character and encounter, with warnings where they mix.' },
];

const ADVANCEMENT: { id: CampaignRules['advancement']; label: string; hint: string }[] = [
  {
    id: 'milestone',
    label: 'Milestones',
    hint: 'Characters level up when you say so; no XP anywhere.',
  },
  {
    id: 'xp',
    label: 'Experience points',
    hint: 'Characters track XP; encounters show what they are worth.',
  },
];

const ENCUMBRANCE: { id: CampaignRules['encumbrance']; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'standard', label: 'Standard (carrying capacity)' },
  { id: 'variant', label: 'Variant (encumbered, heavily encumbered)' },
];

export const fieldLabel = 'mb-2 block text-[11px] font-semibold tracking-wider uppercase';

export function EditionPicker({
  value,
  onChange,
}: {
  value: CampaignEdition;
  onChange: (edition: CampaignEdition) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={fieldLabel}>Edition</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {EDITIONS.map((e) => (
          <label
            key={e.id}
            className={cn(
              'flex cursor-pointer flex-col rounded-md border bg-surface p-3',
              value === e.id ? 'border-accent ring-1 ring-accent' : 'border-border',
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name={name}
                checked={value === e.id}
                onChange={() => {
                  onChange(e.id);
                }}
                className="accent-accent"
              />
              {EDITION_LABELS[e.id]}
            </span>
            <span className="mt-1 text-xs text-muted">{e.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RulesFields({
  value,
  onChange,
}: {
  value: CampaignRules;
  onChange: (rules: CampaignRules) => void;
}) {
  const name = useId();
  const advancementName = useId();
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={fieldLabel}>Advancement</legend>
        <div className="flex flex-col gap-1.5">
          {ADVANCEMENT.map((o) => (
            <label key={o.id} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={advancementName}
                checked={value.advancement === o.id}
                onChange={() => {
                  onChange({ ...value, advancement: o.id });
                }}
                className="mt-0.5 accent-accent"
              />
              <span>
                {o.label}
                <span className="block text-xs text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={fieldLabel}>Encumbrance</legend>
        <div className="flex flex-col gap-1.5">
          {ENCUMBRANCE.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                checked={value.encumbrance === o.id}
                onChange={() => {
                  onChange({ ...value, encumbrance: o.id });
                }}
                className="accent-accent"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.optionalClassFeatures}
          onChange={(e) => {
            onChange({ ...value, optionalClassFeatures: e.target.checked });
          }}
          className="mt-0.5 accent-accent"
        />
        <span>
          Optional class features (2014)
          <span className="block text-xs text-muted">
            Offered by the character builder, from Tasha&apos;s Cauldron of Everything.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted">
        Variant rules and playtest material are chosen through the sources.
      </p>
    </div>
  );
}
