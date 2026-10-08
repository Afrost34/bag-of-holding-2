import {
  ABILITY_IDS,
  backgroundToForm,
  classToForm,
  emptyBackground,
  emptyClass,
  emptyFeat,
  emptySpecies,
  FEAT_CATEGORIES,
  featToForm,
  formToBackground,
  formToClass,
  formToFeat,
  formToSpecies,
  SKILL_NAMES,
  speciesToForm,
  type AbilityId,
  type ClassForm,
  type PackMeta,
  type RawEntity,
} from '@boh/data5e';
import { Entries, EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Grid, NumberField, Section, Select, Text, TextArea } from './fields';

/**
 * Editors for homebrew feats, backgrounds, species and classes: forms on the left, the entry as
 * the compendium will show it on the right.
 */

const ABILITY_NAMES: Record<AbilityId, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
const capital = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase());

interface EditorProps {
  pack: PackMeta;
  base: RawEntity | null;
  onSave: (entity: RawEntity) => Promise<string | null>;
  onCancel: () => void;
}

/** Form and preview side by side, with Save and Cancel. */
function Layout({
  label,
  preview,
  onSave,
  onCancel,
  problem,
  saving,
  children,
}: {
  label: string;
  preview: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  problem: string | null;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <form
        aria-label={label}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {children}
        {problem && (
          <p role="alert" className="text-sm text-accent-ink">
            {problem}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : `Save ${label.toLowerCase()}`}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
      <aside
        aria-label="Preview"
        className="rounded-lg border border-border bg-surface p-4 lg:sticky lg:top-4 lg:self-start"
      >
        {preview}
      </aside>
    </div>
  );
}

/** Pills to pick some of a list (abilities, skills). */
function Picks<T extends string>({
  label,
  options,
  value,
  onChange,
  max,
  name = capital,
}: {
  label: string;
  options: readonly T[];
  value: readonly T[];
  onChange: (v: T[]) => void;
  max?: number;
  name?: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={!on && max !== undefined && value.length >= max}
              onClick={() => {
                onChange(on ? value.filter((v) => v !== o) : [...value, o]);
              }}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-sm disabled:opacity-40',
                on
                  ? 'border-accent bg-accent-soft font-semibold'
                  : 'border-border hover:border-accent',
              )}
            >
              {name(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function useSaving(onSave: (e: RawEntity) => Promise<string | null>) {
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (name: string, entity: RawEntity, what: string) => {
    if (!name.trim()) {
      setProblem(`Give the ${what} a name.`);
      return;
    }
    setSaving(true);
    setProblem(await onSave(entity));
    setSaving(false);
  };
  return { problem, saving, save };
}

export function FeatEditor({ pack, base, onSave, onCancel }: EditorProps) {
  const [form, setForm] = useState(() => (base ? featToForm(base) : emptyFeat()));
  const { problem, saving, save } = useSaving(onSave);
  const feat = { ...formToFeat(form, pack.edition, base ?? {}), source: pack.id };
  return (
    <Layout
      label="Feat"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => void save(form.name, feat, 'feat')}
      preview={<EntityView type="feat" data={feat} edition={pack.edition} />}
    >
      <Section title="Basics">
        <Text
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => {
            setForm({ ...form, name: v });
          }}
        />
        <Grid>
          <Select
            label="Category"
            value={form.category}
            options={FEAT_CATEGORIES}
            onChange={(v) => {
              setForm({ ...form, category: v });
            }}
          />
          <NumberField
            label="Level needed"
            value={form.level || null}
            onChange={(v) => {
              setForm({ ...form, level: v ?? 0 });
            }}
          />
        </Grid>
        <Text
          label="Other prerequisite"
          value={form.prerequisite}
          placeholder="Proficiency with a martial weapon"
          onChange={(v) => {
            setForm({ ...form, prerequisite: v });
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.repeatable}
            onChange={(e) => {
              setForm({ ...form, repeatable: e.target.checked });
            }}
          />
          Can be taken more than once
        </label>
        <Picks
          label="Ability Score Increase (+1 to one of)"
          options={ABILITY_IDS}
          value={form.abilityFrom}
          name={(a) => ABILITY_NAMES[a]}
          onChange={(v) => {
            setForm({ ...form, abilityFrom: v });
          }}
        />
      </Section>
      <Section title="What it does">
        <TextArea
          label="Benefits"
          hint="Paragraphs separated by a blank line; dice like 2d6 fire become rolls."
          value={form.text}
          onChange={(v) => {
            setForm({ ...form, text: v });
          }}
        />
      </Section>
    </Layout>
  );
}

export function BackgroundEditor({ pack, base, onSave, onCancel }: EditorProps) {
  const [form, setForm] = useState(() => (base ? backgroundToForm(base) : emptyBackground()));
  const { problem, saving, save } = useSaving(onSave);
  const bg = { ...formToBackground(form, pack.edition, base ?? {}), source: pack.id };
  return (
    <Layout
      label="Background"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => void save(form.name, bg, 'background')}
      preview={<EntityView type="background" data={bg} edition={pack.edition} />}
    >
      <Section title="Basics">
        <Text
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => {
            setForm({ ...form, name: v });
          }}
        />
        {pack.edition === '2024' && (
          <>
            <Picks
              label="Ability Scores (three: +2 / +1 or +1 to each)"
              options={ABILITY_IDS}
              value={form.abilities}
              max={3}
              name={(a) => ABILITY_NAMES[a]}
              onChange={(v) => {
                setForm({ ...form, abilities: v });
              }}
            />
            <Text
              label="Origin feat"
              value={form.feat}
              placeholder="alert|xphb"
              onChange={(v) => {
                setForm({ ...form, feat: v.trim() });
              }}
            />
          </>
        )}
        <Picks
          label="Skill proficiencies (two)"
          options={SKILL_NAMES}
          value={form.skills}
          max={2}
          onChange={(v) => {
            setForm({ ...form, skills: v });
          }}
        />
        <Grid>
          <Text
            label="Tool proficiency"
            value={form.tool}
            placeholder="navigator's tools"
            onChange={(v) => {
              setForm({ ...form, tool: v });
            }}
          />
          <NumberField
            label="Languages of choice"
            value={form.languages || null}
            onChange={(v) => {
              setForm({ ...form, languages: v ?? 0 });
            }}
          />
        </Grid>
        <Text
          label="Equipment"
          value={form.equipment}
          placeholder="A rope, 10 GP"
          onChange={(v) => {
            setForm({ ...form, equipment: v });
          }}
        />
      </Section>
      <Section title="Story">
        <TextArea
          label="Description"
          value={form.text}
          onChange={(v) => {
            setForm({ ...form, text: v });
          }}
        />
      </Section>
    </Layout>
  );
}

export function SpeciesEditor({ pack, base, onSave, onCancel }: EditorProps) {
  const [form, setForm] = useState(() => (base ? speciesToForm(base) : emptySpecies()));
  const { problem, saving, save } = useSaving(onSave);
  const race = { ...formToSpecies(form, pack.edition, base ?? {}), source: pack.id };
  return (
    <Layout
      label="Species"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => void save(form.name, race, 'species')}
      preview={<EntityView type="race" data={race} edition={pack.edition} />}
    >
      <Section title="Basics">
        <Text
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => {
            setForm({ ...form, name: v });
          }}
        />
        <Grid>
          <Select
            label="Size"
            value={form.size}
            options={[
              { id: 'S', label: 'Small' },
              { id: 'M', label: 'Medium' },
              { id: 'L', label: 'Large' },
            ]}
            onChange={(v) => {
              setForm({ ...form, size: v === 'S' || v === 'L' ? v : 'M' });
            }}
          />
          <NumberField
            label="Speed (ft)"
            value={form.speed}
            onChange={(v) => {
              setForm({ ...form, speed: v ?? 30 });
            }}
          />
          <NumberField
            label="Darkvision (ft)"
            value={form.darkvision || null}
            onChange={(v) => {
              setForm({ ...form, darkvision: v ?? 0 });
            }}
          />
        </Grid>
      </Section>
      <Section title="Traits">
        {form.traits.map((t, i) => (
          <div key={i} className="space-y-1 rounded-md border border-border p-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Text
                  label={`Trait ${String(i + 1)}`}
                  value={t.name}
                  onChange={(v) => {
                    setForm({
                      ...form,
                      traits: form.traits.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    });
                  }}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove trait ${String(i + 1)}`}
                onClick={() => {
                  setForm({ ...form, traits: form.traits.filter((_, j) => j !== i) });
                }}
                className="self-end rounded p-1.5 text-muted hover:bg-sunken"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <TextArea
              label={`What trait ${String(i + 1)} does`}
              value={t.text}
              onChange={(v) => {
                setForm({
                  ...form,
                  traits: form.traits.map((x, j) => (j === i ? { ...x, text: v } : x)),
                });
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setForm({ ...form, traits: [...form.traits, { name: '', text: '' }] });
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a trait
        </Button>
      </Section>
    </Layout>
  );
}

const ARMOR = ['light', 'medium', 'heavy', 'shield'] as const;
const WEAPONS = ['simple', 'martial'] as const;
const SPELL_LISTS = [
  'Artificer',
  'Bard',
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard',
];

export function ClassEditor({
  pack,
  base,
  features: baseFeatures,
  onSave,
  onCancel,
}: Omit<EditorProps, 'onSave'> & {
  features: readonly RawEntity[];
  onSave: (cls: RawEntity, features: RawEntity[]) => Promise<string | null>;
}) {
  const [form, setForm] = useState<ClassForm>(() =>
    base ? classToForm(base, baseFeatures) : emptyClass(),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { cls, features } = formToClass(form, pack.edition, pack.id, base ?? {});
  const set = <K extends keyof ClassForm>(key: K, value: ClassForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  return (
    <Layout
      label="Class"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => {
        if (!form.name.trim()) {
          setProblem('Give the class a name.');
          return;
        }
        setSaving(true);
        void onSave({ ...cls, source: pack.id }, features).then((p) => {
          setProblem(p);
          setSaving(false);
        });
      }}
      preview={
        <div className="space-y-2 text-sm">
          <h3 className="font-serif text-lg font-bold">{form.name || 'New class'}</h3>
          <p>
            <strong>Hit die:</strong> d{form.hitDie} · <strong>Saves:</strong>{' '}
            {form.saves.map((a) => ABILITY_NAMES[a]).join(', ') || '—'}
          </p>
          {features.map((f) => (
            <section key={`${String(f.level)}-${String(f.name)}`}>
              <h4 className="font-serif font-bold">
                <span className="text-muted">Level {String(f.level)}: </span>
                {String(f.name)}
              </h4>
              <Entries entries={f.entries} />
            </section>
          ))}
        </div>
      }
    >
      <Section title="Basics">
        <Text
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => {
            set('name', v);
          }}
        />
        <Grid>
          <Select
            label="Hit die"
            value={String(form.hitDie)}
            options={[6, 8, 10, 12].map((d) => ({ id: String(d), label: `d${String(d)}` }))}
            onChange={(v) => {
              set('hitDie', Number(v) as ClassForm['hitDie']);
            }}
          />
          <Select
            label="Primary ability"
            value={form.primary}
            options={ABILITY_IDS.map((a) => ({ id: a, label: ABILITY_NAMES[a] }))}
            onChange={(v) => {
              set('primary', v as AbilityId);
            }}
          />
        </Grid>
        <Picks
          label="Saving throws (two)"
          options={ABILITY_IDS}
          value={form.saves}
          max={2}
          name={(a) => ABILITY_NAMES[a]}
          onChange={(v) => {
            set('saves', v);
          }}
        />
        <Picks
          label="Armor training"
          options={ARMOR}
          value={form.armor as (typeof ARMOR)[number][]}
          onChange={(v) => {
            set('armor', v);
          }}
        />
        <Picks
          label="Weapon proficiencies"
          options={WEAPONS}
          value={form.weapons as (typeof WEAPONS)[number][]}
          onChange={(v) => {
            set('weapons', v);
          }}
        />
        <Picks
          label="Skills to choose from"
          options={SKILL_NAMES}
          value={form.skillsFrom as (typeof SKILL_NAMES)[number][]}
          onChange={(v) => {
            set('skillsFrom', v);
          }}
        />
        <NumberField
          label="Skills chosen"
          value={form.skillCount}
          onChange={(v) => {
            set('skillCount', v ?? 2);
          }}
        />
        <Text
          label="Subclass title"
          value={form.subclassTitle}
          placeholder="Corsair Crew"
          onChange={(v) => {
            set('subclassTitle', v);
          }}
        />
      </Section>
      <Section title="Spellcasting">
        <Grid>
          <Select
            label="Casting"
            value={form.caster}
            options={[
              { id: 'none', label: 'None' },
              { id: 'full', label: 'Full caster (like a Wizard)' },
              { id: 'half', label: 'Half caster (like a Paladin)' },
              { id: 'pact', label: 'Pact magic (like a Warlock)' },
            ]}
            onChange={(v) => {
              set('caster', v as ClassForm['caster']);
            }}
          />
          {form.caster !== 'none' && (
            <>
              <Select
                label="Spellcasting ability"
                value={form.spellAbility}
                options={ABILITY_IDS.map((a) => ({ id: a, label: ABILITY_NAMES[a] }))}
                onChange={(v) => {
                  set('spellAbility', v as AbilityId);
                }}
              />
              <Select
                label="Spell list"
                value={form.spellList}
                options={[
                  { id: '', label: 'Its own' },
                  ...SPELL_LISTS.map((s) => ({ id: s, label: s })),
                ]}
                onChange={(v) => {
                  set('spellList', v);
                }}
              />
            </>
          )}
        </Grid>
      </Section>
      <Section title="Features">
        {form.features.map((f, i) => (
          <div key={i} className="space-y-1 rounded-md border border-border p-2">
            <div className="flex gap-2">
              <div className="w-24">
                <NumberField
                  label="Level"
                  value={f.level}
                  onChange={(v) => {
                    set(
                      'features',
                      form.features.map((x, j) =>
                        j === i ? { ...x, level: Math.min(20, Math.max(1, v ?? 1)) } : x,
                      ),
                    );
                  }}
                />
              </div>
              <div className="flex-1">
                <Text
                  label={`Feature ${String(i + 1)}`}
                  value={f.name}
                  onChange={(v) => {
                    set(
                      'features',
                      form.features.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    );
                  }}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove feature ${String(i + 1)}`}
                onClick={() => {
                  set(
                    'features',
                    form.features.filter((_, j) => j !== i),
                  );
                }}
                className="self-end rounded p-1.5 text-muted hover:bg-sunken"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <TextArea
              label={`What feature ${String(i + 1)} does`}
              value={f.text}
              onChange={(v) => {
                set(
                  'features',
                  form.features.map((x, j) => (j === i ? { ...x, text: v } : x)),
                );
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const last = form.features.at(-1)?.level ?? 0;
            set('features', [
              ...form.features,
              { level: Math.min(20, last + 1 || 1), name: '', text: '' },
            ]);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a feature
        </Button>
      </Section>
    </Layout>
  );
}
