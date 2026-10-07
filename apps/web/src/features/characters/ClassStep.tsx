import { secureRng } from '@boh/dice';
import type { ClassLevels } from '@boh/rules';
import { Button, cn } from '@boh/ui';
import { Dices, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EntityPicker } from './EntityPicker';
import { ChoiceList, FeatureList, type StepProps } from './OriginSteps';
import { forget, hitPointLevels } from './steps';

const MAX_LEVEL = 20;

/**
 * Classes and levels: the starting class, more classes for a multiclass, hit points per level,
 * then every choice the classes ask for. Levelling up is changing a level here.
 */
export function ClassStep(props: StepProps) {
  const { decisions, view, update } = props;
  const classes = decisions.classes;
  const total = classes.reduce((n, c) => n + c.levels, 0);
  const [adding, setAdding] = useState(false);

  const setClasses = (next: ClassLevels[], forgetKeys: (string | undefined)[] = []) => {
    const cleaned = forget(decisions, ...forgetKeys);
    // Rolled hit points follow the levels: keep what fits, average for new levels.
    const rolls = decisions.hitPointRolls;
    const levels = next.reduce((n, c) => n + c.levels, 0);
    update({
      ...cleaned,
      classes: next,
      ...(rolls ? { hitPointRolls: rolls.slice(0, Math.max(0, levels - 1)) } : {}),
    });
  };
  const subclassOf = (key: string) => view?.classes.find((c) => c.key === key)?.subclass;

  return (
    <div className="space-y-5">
      {classes.length === 0 ? (
        <EntityPicker
          category="classes"
          types={['class']}
          noun="Class"
          plural="classes"
          value={undefined}
          edition={decisions.edition}
          isEnabled={props.isEnabled}
          onPick={(key) => {
            if (key) setClasses([{ class: key, levels: 1 }]);
          }}
        />
      ) : (
        classes.map((c, i) => (
          <div key={c.class} className="space-y-2">
            <EntityPicker
              category="classes"
              types={['class']}
              noun={i === 0 ? 'Class' : 'Multiclass'}
              plural="classes"
              value={c.class}
              edition={decisions.edition}
              isEnabled={props.isEnabled}
              onPick={(key) => {
                if (!key || classes.some((x) => x.class === key)) return;
                setClasses(
                  classes.map((x, j) => (j === i ? { class: key, levels: x.levels } : x)),
                  [c.class, subclassOf(c.class)],
                );
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor={`class-level-${String(i)}`} className="font-medium">
                {i === 0 ? 'Level' : `${view?.classes[i]?.name ?? 'Class'} level`}
              </label>
              <select
                id={`class-level-${String(i)}`}
                value={c.levels}
                onChange={(e) => {
                  setClasses(
                    classes.map((x, j) => (j === i ? { ...x, levels: Number(e.target.value) } : x)),
                  );
                }}
                className="rounded-md border border-border bg-surface px-3 py-2"
              >
                {Array.from({ length: MAX_LEVEL - (total - c.levels) }, (_, n) => n + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ),
                )}
              </select>
              {i > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setClasses(
                      classes.filter((_, j) => j !== i),
                      [c.class, subclassOf(c.class)],
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove{' '}
                  {view?.classes[i]?.name ?? 'class'}
                </Button>
              )}
            </div>
          </div>
        ))
      )}

      {classes.length > 0 && total < MAX_LEVEL && (
        <div>
          {adding ? (
            <EntityPicker
              category="classes"
              types={['class']}
              noun="Multiclass"
              plural="classes"
              value={undefined}
              edition={decisions.edition}
              isEnabled={(s) => props.isEnabled(s)}
              onPick={(key) => {
                setAdding(false);
                if (key && !classes.some((x) => x.class === key))
                  setClasses([...classes, { class: key, levels: 1 }]);
              }}
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add a class (multiclass)
            </Button>
          )}
        </div>
      )}

      {classes.length > 0 && view && <HitPoints {...props} />}
      <ChoiceList {...props} />
      <FeatureList view={view} from={(k) => k.startsWith('class:') || k.startsWith('subclass:')} />
    </div>
  );
}

/** Hit points: the average for every level after the first, or rolls. */
function HitPoints({ decisions, view, update }: StepProps) {
  if (!view) return null;
  const levels = hitPointLevels(view.sheet.hitDice, view.classes);
  const rolls = decisions.hitPointRolls;
  const average = (faces: number) => faces / 2 + 1;
  const setRolls = (next: number[] | undefined) => {
    const { hitPointRolls: _old, ...rest } = decisions;
    update(next ? { ...rest, hitPointRolls: next } : rest);
  };
  return (
    <section aria-label="Hit points" className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h3 className="flex-1 font-serif text-lg font-bold">Hit points: {view.sheet.hp.value}</h3>
        <div
          role="radiogroup"
          aria-label="Hit points method"
          className="flex rounded-md border border-border p-0.5 text-sm"
        >
          {(['average', 'rolled'] as const).map((m) => {
            const on = m === 'rolled' ? rolls !== undefined : rolls === undefined;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setRolls(m === 'rolled' ? levels.map((l) => average(l.faces)) : undefined);
                }}
                className={cn(
                  'rounded px-2.5 py-1',
                  on ? 'bg-accent text-accent-fg' : 'hover:bg-sunken',
                )}
              >
                {m === 'average' ? 'Average' : 'Rolled'}
              </button>
            );
          })}
        </div>
      </div>
      {levels.length === 0 ? (
        <p className="text-sm text-muted">Level 1 takes the highest roll of the hit die.</p>
      ) : rolls === undefined ? (
        <p className="text-sm text-muted">
          Each level after the first adds the hit die's average and your Constitution modifier.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {levels.map((l, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm"
            >
              <span className="text-muted">{l.label}</span>
              <input
                type="number"
                min={1}
                max={l.faces}
                aria-label={`Hit point roll for ${l.label}`}
                value={rolls[i] ?? average(l.faces)}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(l.faces, Math.round(Number(e.target.value) || 1)));
                  setRolls(levels.map((x, j) => (j === i ? n : (rolls[j] ?? average(x.faces)))));
                }}
                className="w-14 rounded border border-border bg-surface px-1.5 py-0.5"
              />
              <button
                type="button"
                aria-label={`Roll d${String(l.faces)} for ${l.label}`}
                onClick={() => {
                  const n = secureRng(l.faces);
                  setRolls(levels.map((x, j) => (j === i ? n : (rolls[j] ?? average(x.faces)))));
                }}
                className="rounded p-0.5 text-muted hover:text-accent"
              >
                <Dices className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
