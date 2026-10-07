import type { AnsweredChoice, CharacterDecisions } from '@boh/rules';
import { cn } from '@boh/ui';
import type { CharacterView } from '../../app/data/protocol';
import { ChoiceCard } from './ChoiceCard';
import { EntityPicker } from './EntityPicker';
import { forget } from './steps';

/** Shared props of the builder's steps. */
export interface StepProps {
  decisions: CharacterDecisions;
  view: CharacterView | null;
  /** This step's choices, in the engine's order. */
  choices: AnsweredChoice[];
  isEnabled: (source: string | undefined) => boolean;
  update: (next: CharacterDecisions) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
}

export function ChoiceList({
  choices,
  view,
  decisions,
  isEnabled,
  setPicks,
  empty,
}: Pick<StepProps, 'choices' | 'view' | 'decisions' | 'isEnabled' | 'setPicks'> & {
  empty?: string;
}) {
  if (choices.length === 0) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  const nameOf = (key: string) =>
    key === 'character'
      ? 'Your character'
      : (view?.entities.find((e) => e.key === key)?.name ?? '');
  return (
    <div className="space-y-2">
      {choices.map((c) => (
        <ChoiceCard
          key={c.id}
          choice={c}
          decisions={decisions}
          origin={nameOf(c.from)}
          isEnabled={isEnabled}
          onChange={(picks) => {
            setPicks(c.id, picks);
          }}
        />
      ))}
    </div>
  );
}

/** The features the character has from a set of entities, by level. */
export function FeatureList({
  view,
  from,
}: {
  view: CharacterView | null;
  from: (key: string) => boolean;
}) {
  const features = (view?.features ?? []).filter((f) => from(f.from) && !f.key.includes('#'));
  if (features.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-serif text-lg font-bold">Features</h3>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {features.map((f) => (
          <li key={f.key} className="flex items-baseline gap-3 px-4 py-2">
            {f.level !== undefined && (
              <span className="w-14 shrink-0 text-xs text-muted">Level {f.level}</span>
            )}
            <span className="font-medium">{f.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpeciesStep(props: StepProps) {
  const { decisions, view, update } = props;
  const traits = (view?.features ?? []).filter(
    (f) => f.from === decisions.species || f.from.startsWith('subrace:'),
  );
  return (
    <div className="space-y-5">
      <EntityPicker
        category="species"
        types={['race']}
        noun="Species"
        plural="species"
        value={decisions.species}
        edition={decisions.edition}
        isEnabled={props.isEnabled}
        onPick={(key) => {
          const cleaned = forget(decisions, decisions.species);
          update({ ...cleaned, ...(key ? { species: key } : {}) });
        }}
      />
      <ChoiceList {...props} />
      {traits.length > 0 && (
        <div>
          <h3 className="mb-2 font-serif text-lg font-bold">Traits</h3>
          <ul className="flex flex-wrap gap-2">
            {traits.map((t) => (
              <li key={t.key} className="rounded-full border border-border px-3 py-1 text-sm">
                {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BackgroundStep(props: StepProps) {
  const { decisions, update } = props;
  return (
    <div className="space-y-5">
      <EntityPicker
        category="backgrounds"
        types={['background']}
        noun="Background"
        plural="backgrounds"
        value={decisions.background}
        edition={decisions.edition}
        isEnabled={props.isEnabled}
        onPick={(key) => {
          const cleaned = forget(decisions, decisions.background);
          update({ ...cleaned, ...(key ? { background: key } : {}) });
        }}
      />
      <ChoiceList {...props} />
    </div>
  );
}

/** Equipment and spells: for now the engine's choices for them, nothing more. */
export function ChoicesOnlyStep(props: StepProps & { empty: string }) {
  return (
    <div className={cn('space-y-5')}>
      <ChoiceList {...props} />
    </div>
  );
}
