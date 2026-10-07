import { cn } from '@boh/ui';
import type { ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import type { CharacterFile, CharacterPreferences } from '../../app/characters/model';
import { selectClass } from './styles';
import { StepTitle } from './ui';

/**
 * Home: the character's preferences, as on D&D Beyond: which rules, which sources, optional
 * rules, how hit points go up and how ability scores are shown.
 */
export function HomeStep({
  character,
  campaignName,
  save,
}: {
  character: CharacterFile;
  campaignName: string | undefined;
  save: (c: CharacterFile) => void;
}) {
  const prefs = character.preferences;
  const decisions = character.decisions;
  const setPref = <K extends keyof CharacterPreferences>(
    key: K,
    value: CharacterPreferences[K],
  ) => {
    save({ ...character, preferences: { ...prefs, [key]: value } });
  };
  return (
    <div className="space-y-6">
      <StepTitle>Character Preferences</StepTitle>

      <Group
        title="Rules"
        hint="The edition the builder follows. Options from the other edition stay available, marked as such."
      >
        <div className="flex flex-wrap gap-4 text-sm">
          {(['2024', '2014'] as const).map((e) => (
            <label key={e} className="flex items-center gap-2">
              <input
                type="radio"
                name="character-edition"
                checked={decisions.edition === e}
                onChange={() => {
                  save({ ...character, decisions: { ...decisions, edition: e } });
                }}
              />
              {e === '2024' ? '2024 rules (5.5e)' : '2014 rules (5e)'}
            </label>
          ))}
        </div>
      </Group>

      <Group
        title="Sources"
        hint={
          <>
            Only books turned on are offered.{' '}
            {campaignName ? (
              <>
                This character belongs to <strong>{campaignName}</strong>, which has its own list:{' '}
                <AppLink
                  to={`/campaigns/${character.campaign ?? ''}`}
                  className="text-link hover:underline"
                >
                  campaign settings
                </AppLink>
                .
              </>
            ) : (
              <>
                Change them in{' '}
                <AppLink to="/settings/data" className="text-link hover:underline">
                  Data &amp; sources
                </AppLink>
                .
              </>
            )}
          </>
        }
      />

      <Group title="Optional Features" hint="Allow or restrict optional rules for this character.">
        <Check
          label="Feats instead of Ability Score Improvements (2014)"
          checked={prefs.feats}
          onChange={(v) => {
            setPref('feats', v);
          }}
        />
      </Group>

      <Group
        title="Hit Point Type"
        hint="When levelling up, add the fixed value of the class's hit die, or a rolled value."
      >
        <select
          aria-label="Hit point type"
          value={decisions.hitPointRolls ? 'rolled' : 'fixed'}
          onChange={(e) => {
            const { hitPointRolls: _old, ...rest } = decisions;
            save({
              ...character,
              decisions: e.target.value === 'rolled' ? { ...rest, hitPointRolls: [] } : rest,
            });
          }}
          className={cn(selectClass, 'max-w-xs')}
        >
          <option value="fixed">Fixed</option>
          <option value="rolled">Manual (rolled)</option>
        </select>
      </Group>

      <Group
        title="Use Prerequisites"
        hint="Allow or restrict choices based on rule prerequisites."
      >
        <Check
          label="Multiclass requirements"
          checked={prefs.multiclassRequirements}
          onChange={(v) => {
            setPref('multiclassRequirements', v);
          }}
        />
      </Group>

      <Group
        title="Ability Score / Modifier Display"
        hint="Which of the two the sheet shows large."
      >
        <select
          aria-label="Ability score display"
          value={prefs.abilityDisplay}
          onChange={(e) => {
            setPref('abilityDisplay', e.target.value === 'scores' ? 'scores' : 'modifiers');
          }}
          className={cn(selectClass, 'max-w-xs')}
        >
          <option value="modifiers">Modifiers Top</option>
          <option value="scores">Scores Top</option>
        </select>
      </Group>
    </div>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="font-bold">{title}</h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="accent-accent"
      />
      {label}
    </label>
  );
}
