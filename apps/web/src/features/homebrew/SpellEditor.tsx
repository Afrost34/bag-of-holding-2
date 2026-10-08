import {
  AREA_SHAPES,
  CASTING_UNITS,
  DURATION_KINDS,
  emptySpell,
  formToSpell,
  RANGE_KINDS,
  SPELL_CLASSES,
  SPELL_SCHOOLS,
  spellToForm,
  type PackMeta,
  type RawEntity,
  type SpellForm,
} from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { useState } from 'react';
import { Grid, NumberField, Section, Select, Text, TextArea } from './fields';

const LEVELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** A spell made or changed with a form, shown as it will look in the compendium as you type. */
export function SpellEditor({
  pack,
  base,
  onSave,
  onCancel,
}: {
  pack: PackMeta;
  base: RawEntity | null;
  onSave: (spell: RawEntity) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SpellForm>(() => (base ? spellToForm(base) : emptySpell()));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SpellForm>(key: K, value: SpellForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const spell = { ...formToSpell(form, pack.edition, base ?? {}), source: pack.id };

  const save = async () => {
    if (!form.name.trim()) {
      setProblem('Give the spell a name.');
      return;
    }
    setSaving(true);
    setProblem(await onSave(spell));
    setSaving(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <form
        aria-label="Spell"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section title="Basics">
          <Text
            label="Name"
            value={form.name}
            onChange={(v) => {
              set('name', v);
            }}
            autoFocus
          />
          <Grid>
            <Select
              label="Level"
              value={String(form.level)}
              onChange={(v) => {
                set('level', Number(v));
              }}
              options={LEVELS.map((l, i) => ({ id: String(i), label: l }))}
            />
            <Select
              label="School"
              value={form.school}
              onChange={(v) => {
                set('school', v as SpellForm['school']);
              }}
              options={SPELL_SCHOOLS.map(([id, label]) => ({ id, label }))}
            />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.ritual}
                onChange={(e) => {
                  set('ritual', e.target.checked);
                }}
              />
              Ritual
            </label>
          </Grid>
        </Section>

        <Section title="Casting">
          <Grid>
            <Select
              label="Casting time"
              value={form.castingUnit}
              onChange={(v) => {
                set('castingUnit', v as SpellForm['castingUnit']);
              }}
              options={CASTING_UNITS.map(([id, label]) => ({ id, label }))}
            />
            {(form.castingUnit === 'minute' || form.castingUnit === 'hour') && (
              <NumberField
                label="How many"
                value={form.castingNumber}
                onChange={(v) => {
                  set('castingNumber', v ?? 1);
                }}
              />
            )}
          </Grid>
          {form.castingUnit === 'reaction' && (
            <Text
              label="Reaction trigger"
              placeholder="which you take when you are hit by an attack"
              value={form.trigger}
              onChange={(v) => {
                set('trigger', v);
              }}
            />
          )}
          <Grid>
            <Select
              label="Range"
              value={form.rangeKind}
              onChange={(v) => {
                set('rangeKind', v as SpellForm['rangeKind']);
              }}
              options={RANGE_KINDS.map(([id, label]) => ({ id, label }))}
            />
            {(form.rangeKind === 'feet' ||
              form.rangeKind === 'miles' ||
              form.rangeKind === 'area') && (
              <NumberField
                label={form.rangeKind === 'miles' ? 'Miles' : 'Feet'}
                value={form.rangeAmount}
                onChange={(v) => {
                  set('rangeAmount', v ?? 0);
                }}
              />
            )}
            {form.rangeKind === 'area' && (
              <Select
                label="Area"
                value={form.areaShape}
                onChange={(v) => {
                  set('areaShape', v as SpellForm['areaShape']);
                }}
                options={AREA_SHAPES.map((s) => ({
                  id: s,
                  label: s.charAt(0).toUpperCase() + s.slice(1),
                }))}
              />
            )}
          </Grid>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Components</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.verbal}
                  onChange={(e) => {
                    set('verbal', e.target.checked);
                  }}
                />
                Verbal
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.somatic}
                  onChange={(e) => {
                    set('somatic', e.target.checked);
                  }}
                />
                Somatic
              </label>
            </div>
          </fieldset>
          <Text
            label="Material (optional)"
            placeholder="a pinch of rust"
            value={form.material}
            onChange={(v) => {
              set('material', v);
            }}
          />
          <Grid>
            <Select
              label="Duration"
              value={form.durationKind}
              onChange={(v) => {
                set('durationKind', v as SpellForm['durationKind']);
              }}
              options={DURATION_KINDS.map(([id, label]) => ({ id, label }))}
            />
            {(form.durationKind === 'timed' || form.durationKind === 'concentration') && (
              <>
                <NumberField
                  label={form.durationKind === 'concentration' ? 'Up to' : 'Lasts'}
                  value={form.durationAmount}
                  onChange={(v) => {
                    set('durationAmount', v ?? 1);
                  }}
                />
                <Select
                  label="Unit"
                  value={form.durationUnit}
                  onChange={(v) => {
                    set('durationUnit', v as SpellForm['durationUnit']);
                  }}
                  options={[
                    { id: 'round', label: 'Rounds' },
                    { id: 'minute', label: 'Minutes' },
                    { id: 'hour', label: 'Hours' },
                    { id: 'day', label: 'Days' },
                  ]}
                />
              </>
            )}
          </Grid>
        </Section>

        <Section title="Classes">
          <div className="flex flex-wrap gap-1.5">
            {SPELL_CLASSES.map((c) => {
              const on = form.classes.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    set('classes', on ? form.classes.filter((x) => x !== c) : [...form.classes, c]);
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-sm',
                    on
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-border text-muted hover:border-accent',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Description">
          <TextArea
            label="What the spell does"
            hint="Write it as in the book: dice, damage, DCs and conditions become rolls and links."
            value={form.description}
            onChange={(v) => {
              set('description', v);
            }}
          />
          <TextArea
            label={form.level === 0 ? 'Cantrip upgrade (optional)' : 'At higher levels (optional)'}
            value={form.higher}
            onChange={(v) => {
              set('higher', v);
            }}
          />
        </Section>

        {problem && (
          <p role="alert" className="rounded-md bg-sunken px-3 py-2 text-sm">
            {problem}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save spell'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      <aside aria-label="Preview" className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Preview</p>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <h2 className="font-serif text-xl font-bold">{form.name.trim() || 'Unnamed spell'}</h2>
          <p className="mb-2 text-xs text-faint">{pack.name}</p>
          <EntityView type="spell" data={spell} edition={pack.edition} />
        </article>
      </aside>
    </div>
  );
}
