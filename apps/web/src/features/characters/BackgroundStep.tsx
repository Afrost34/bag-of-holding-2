import { Entries } from '@boh/renderer';
import type { AnsweredChoice, CharacterDecisions } from '@boh/rules';
import { useId, useMemo } from 'react';
import type { CharacterDetails, CharacterFile } from '../../app/characters/model';
import { useEntity } from '../../app/data/entities';
import { useListRows } from '../../app/data/lists';
import type { CharacterView } from '../../app/data/protocol';
import { AbilityIncrease } from './AbilityIncrease';
import { isAbilityIncrease } from './increaseModel';
import { ChoiceControl } from './ChoiceControl';
import { forget, pickName } from './steps';
import { selectClass } from './styles';
import { Accordion, StepTitle } from './ui';

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
]; // prettier-ignore
const LIFESTYLES = [
  'Wretched',
  'Squalid',
  'Poor',
  'Modest',
  'Comfortable',
  'Wealthy',
  'Aristocratic',
];

/**
 * Choose Origin: Background, as on D&D Beyond: a dropdown, what the background is and gives, its
 * feat and ability scores as folding rows with their picks, then the character's own details.
 */
export function BackgroundStep({
  character,
  view,
  choices,
  isEnabled,
  update,
  setPicks,
  save,
}: {
  character: CharacterFile;
  view: CharacterView | null;
  choices: AnsweredChoice[];
  isEnabled: (source: string | undefined) => boolean;
  update: (next: CharacterDecisions) => void;
  setPicks: (choiceId: string, picks: string[]) => void;
  save: (c: CharacterFile) => void;
}) {
  const decisions = character.decisions;
  const rows = useListRows('backgrounds');
  const key = decisions.background;
  const background = useEntity(key ?? null);
  const options = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.type === 'background' && (isEnabled(r.source) || r.key === key))
        .sort(
          (a, b) =>
            Number(a.edition !== decisions.edition) - Number(b.edition !== decisions.edition) ||
            a.name.localeCompare(b.name, 'en'),
        ),
    [rows, isEnabled, key, decisions.edition],
  );
  const names = new Map<string, number>();
  for (const o of options) names.set(o.name, (names.get(o.name) ?? 0) + 1);

  const grants = view?.grants ?? [];
  const feats = grants.filter((g) => g.kind === 'feat' && g.from === key);
  const nameOf = (k: string) => view?.entities.find((e) => e.key === k)?.name ?? pickName(k);
  const control = (c: AnsweredChoice) => (
    <ChoiceControl
      key={c.id}
      choice={c}
      decisions={decisions}
      isEnabled={isEnabled}
      onChange={(picks) => {
        setPicks(c.id, picks);
      }}
    />
  );
  const pending = (list: AnsweredChoice[]) => list.some((c) => c.picks.length < c.count);
  const abilities = choices.filter((c) => c.from === key && /\/ability(\/|$)/.test(c.id));
  const increase = abilities.find(isAbilityIncrease);
  const own = choices.filter((c) => c.from === key && !abilities.includes(c));
  const languages = choices.filter((c) => c.from === 'character');

  return (
    <div className="space-y-5">
      <StepTitle hint="Your background is where you come from and what you did before adventuring.">
        Choose Origin: Background
      </StepTitle>
      <select
        aria-label="Background"
        value={key ?? ''}
        onChange={(e) => {
          const next = forget(
            decisions,
            key,
            ...feats.map((f) => (f.kind === 'feat' ? f.key : undefined)),
          );
          update({ ...next, ...(e.target.value ? { background: e.target.value } : {}) });
        }}
        className={`${selectClass} max-w-sm`}
      >
        <option value="">- Choose a Background -</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name}
            {(names.get(o.name) ?? 0) > 1 ? ` (${o.source})` : ''}
            {o.legacy ? ' · Legacy' : ''}
          </option>
        ))}
      </select>

      {key && background.status === 'found' && (
        <div className="space-y-3">
          <div className="text-sm">
            <Entries entries={background.entity.data.entries} />
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {feats.map((f) => {
          if (f.kind !== 'feat') return null;
          const list = choices.filter((c) => c.from === f.key);
          return (
            <Accordion
              key={f.key}
              title={f.version ? featVersionName(f.version) : nameOf(f.key)}
              subtitle={`Granted Feat${list.length ? ` · ${String(list.length)} Choice${list.length === 1 ? '' : 's'}` : ''}`}
              pending={pending(list)}
            >
              <EntityText entityKey={f.key} />
              <div className="mt-3 space-y-3">{list.map(control)}</div>
            </Accordion>
          );
        })}
        {abilities.length > 0 && (
          <Accordion title="Ability Scores" subtitle="1 Choice" pending={pending(abilities)}>
            {increase ? (
              <AbilityIncrease choice={increase} decisions={decisions} update={update} />
            ) : (
              <div className="space-y-3">{abilities.map(control)}</div>
            )}
          </Accordion>
        )}
        {own.length > 0 && (
          <Accordion
            title="Proficiencies"
            subtitle={`${String(own.length)} Choice${own.length === 1 ? '' : 's'}`}
            pending={pending(own)}
          >
            <div className="space-y-3">{own.map(control)}</div>
          </Accordion>
        )}
        {languages.length > 0 && (
          <Accordion
            title="Languages"
            subtitle="Common and two languages of your choice"
            pending={pending(languages)}
          >
            <div className="space-y-3">{languages.map(control)}</div>
          </Accordion>
        )}
      </div>

      <Details character={character} save={save} />
    </div>
  );
}

/** "magic initiate; cleric" → "Magic Initiate (Cleric)". */
const featVersionName = (version: string) => {
  const [base = '', ...rest] = pickName(version).split('; ');
  return rest.length ? `${base} (${rest.join(', ')})` : base;
};

function EntityText({ entityKey }: { entityKey: string }) {
  const state = useEntity(entityKey);
  if (state.status !== 'found') return null;
  return (
    <div className="text-sm">
      <Entries entries={state.entity.data.entries} />
    </div>
  );
}

/** The player's own words about the character, in D&D Beyond's four folding sections. */
function Details({
  character,
  save,
}: {
  character: CharacterFile;
  save: (c: CharacterFile) => void;
}) {
  const id = useId();
  const d = character.details;
  const set = (key: keyof CharacterDetails, value: string) => {
    save({ ...character, details: { ...d, [key]: value } });
  };
  const text = (key: keyof CharacterDetails, label: string) => (
    <div key={key}>
      <label htmlFor={`${id}-${key}`} className="mb-1 block text-sm font-bold">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        value={d[key] ?? ''}
        onChange={(e) => {
          set(key, e.target.value);
        }}
        className={selectClass}
      />
    </div>
  );
  const area = (key: keyof CharacterDetails, label: string) => (
    <div key={key}>
      <label htmlFor={`${id}-${key}`} className="mb-1 block text-sm font-bold uppercase">
        {label}
      </label>
      <textarea
        id={`${id}-${key}`}
        rows={3}
        value={d[key] ?? ''}
        onChange={(e) => {
          set(key, e.target.value);
        }}
        className={selectClass}
      />
    </div>
  );
  const select = (key: keyof CharacterDetails, label: string, values: string[]) => (
    <div key={key}>
      <label htmlFor={`${id}-${key}`} className="mb-1 block text-sm font-bold">
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        value={d[key] ?? ''}
        onChange={(e) => {
          set(key, e.target.value);
        }}
        className={selectClass}
      >
        <option value="">-- Choose an Option --</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </div>
  );
  return (
    <div className="space-y-2.5 border-t border-border pt-5">
      <Accordion title="Character Details" subtitle="Alignment · Faith · Lifestyle">
        <div className="space-y-3">
          {select('alignment', 'Alignment', ALIGNMENTS)}
          {text('faith', 'Faith')}
          {select('lifestyle', 'Lifestyle', LIFESTYLES)}
        </div>
      </Accordion>
      <Accordion
        title="Physical Characteristics"
        subtitle="Hair · Skin · Eyes · Height · Weight · Age · Gender"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {text('hair', 'Hair')}
          {text('skin', 'Skin')}
          {text('eyes', 'Eyes')}
          {text('height', 'Height')}
          {text('weight', 'Weight (lb.)')}
          {text('age', 'Age (years)')}
          {text('gender', 'Gender')}
        </div>
      </Accordion>
      <Accordion title="Personal Characteristics" subtitle="Personality · Ideals · Bonds · Flaws">
        <div className="space-y-3">
          {area('personality', 'Personality traits')}
          {area('ideals', 'Ideals')}
          {area('bonds', 'Bonds')}
          {area('flaws', 'Flaws')}
        </div>
      </Accordion>
      <Accordion title="Notes" subtitle="Organizations · Allies · Enemies · Backstory · Other">
        <div className="space-y-3">
          {area('organizations', 'Organizations')}
          {area('allies', 'Allies')}
          {area('enemies', 'Enemies')}
          {area('backstory', 'Backstory')}
          {area('notes', 'Other')}
        </div>
      </Accordion>
    </div>
  );
}
