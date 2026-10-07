import {
  ALIGNMENT_CODES,
  attackText,
  averageOf,
  CHALLENGE_RATINGS,
  CONDITION_NAMES,
  creatureToForm,
  CREATURE_TYPES,
  DAMAGE_NAMES,
  emptyCreature,
  formToCreature,
  passivePerception,
  proficiency,
  SENSES,
  SIZES,
  SKILLS,
  SPEEDS,
  type AttackSpec,
  type CreatureForm,
  type Feature,
  type PackMeta,
  type RawEntity,
} from '@boh/data5e';
import { ABILITIES, ABILITY_NAME, abilityMod, type Ability } from '@boh/data5e/format';
import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { Plus, Swords, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Grid, NumberField, PictureField, Section, Select, Text, TextArea } from './fields';

const signed = (n: number) => (n >= 0 ? `+${String(n)}` : `−${String(-n)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ATTACK_LABEL = /^(Melee|Ranged)( or Ranged)? (Weapon Attack|Spell Attack|Attack Roll):/;

/**
 * A creature made or changed with a form; the statblock beside it updates as you type, with the
 * proficiency bonus, saves, skills, passive Perception and attack bonuses worked out.
 */
export function CreatureEditor({
  pack,
  base,
  image: initialImage,
  onSave,
  onCancel,
}: {
  pack: PackMeta;
  base: RawEntity | null;
  image: string | null;
  onSave: (creature: RawEntity, image: string | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CreatureForm>(() =>
    base ? creatureToForm(base) : emptyCreature(),
  );
  const [image, setImage] = useState<string | null>(initialImage);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CreatureForm>(key: K, value: CreatureForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const creature = { ...formToCreature(form, pack.edition, base ?? {}), source: pack.id };
  const pb = proficiency(form);
  const mod = (a: Ability) => abilityMod(form.scores[a]);
  const hpAverage = averageOf(form.hpFormula);

  const save = async () => {
    if (!form.name.trim()) {
      setProblem('Give the creature a name.');
      return;
    }
    setSaving(true);
    setProblem(await onSave(creature, image));
    setSaving(false);
  };

  const toggle = (key: 'resist' | 'immune' | 'vulnerable' | 'conditionImmune', value: string) => {
    const list = form[key];
    set(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <form
        aria-label="Creature"
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
              label="Size"
              value={form.size}
              onChange={(v) => {
                set('size', v as CreatureForm['size']);
              }}
              options={SIZES.map(([id, label]) => ({ id, label }))}
            />
            <Select
              label="Type"
              value={form.creatureType}
              onChange={(v) => {
                set('creatureType', v);
              }}
              options={CREATURE_TYPES.map((t) => ({ id: t, label: cap(t) }))}
            />
            <Text
              label="Tags (optional)"
              placeholder="goblinoid"
              value={form.typeTags}
              onChange={(v) => {
                set('typeTags', v);
              }}
            />
            <Select
              label="Alignment"
              value={form.alignment}
              onChange={(v) => {
                set('alignment', v);
              }}
              options={Object.keys(ALIGNMENT_CODES).map((a) => ({ id: a, label: a }))}
            />
            <Select
              label="Challenge rating"
              value={form.cr}
              onChange={(v) => {
                set('cr', v);
              }}
              options={CHALLENGE_RATINGS.map((c) => ({ id: c, label: c }))}
            />
            <p className="self-end pb-2 text-sm text-muted">Proficiency bonus {signed(pb)}</p>
          </Grid>
        </Section>

        <Section title="Armor, hit points and speed">
          <Grid>
            <NumberField
              label="Armor Class"
              value={form.ac}
              onChange={(v) => {
                set('ac', v ?? 10);
              }}
            />
            <Text
              label="Armor (optional)"
              placeholder="natural armor"
              value={form.acFrom}
              onChange={(v) => {
                set('acFrom', v);
              }}
            />
            <div>
              <Text
                label="Hit dice"
                placeholder="4d8 + 4"
                value={form.hpFormula}
                onChange={(v) => {
                  set('hpFormula', v);
                }}
              />
              <p className="mt-1 text-xs text-muted">
                {hpAverage !== null
                  ? `${String(hpAverage)} hit points on average`
                  : 'Or set hit points below'}
              </p>
            </div>
          </Grid>
          {hpAverage === null && (
            <NumberField
              label="Hit points"
              value={form.hpAverage}
              onChange={(v) => {
                set('hpAverage', v);
              }}
            />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SPEEDS.map((s) => (
              <NumberField
                key={s}
                label={s === 'walk' ? 'Speed (ft.)' : `${cap(s)} (ft.)`}
                value={form.speed[s]}
                onChange={(v) => {
                  set('speed', { ...form.speed, [s]: v });
                }}
              />
            ))}
          </div>
          {form.speed.fly !== null && form.speed.fly > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hover}
                onChange={(e) => {
                  set('hover', e.target.checked);
                }}
              />
              Can hover
            </label>
          )}
        </Section>

        <Section title="Ability scores">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {ABILITIES.map((a) => {
              const proficient = form.saves.includes(a);
              return (
                <div key={a} className="space-y-1 text-center">
                  <NumberField
                    label={a.toUpperCase()}
                    value={form.scores[a]}
                    onChange={(v) => {
                      set('scores', { ...form.scores, [a]: v ?? 10 });
                    }}
                  />
                  <p className="text-xs text-muted">{signed(mod(a))}</p>
                  <button
                    type="button"
                    aria-pressed={proficient}
                    aria-label={`${ABILITY_NAME[a]} saving throw`}
                    onClick={() => {
                      set(
                        'saves',
                        proficient ? form.saves.filter((s) => s !== a) : [...form.saves, a],
                      );
                    }}
                    className={cn(
                      'w-full rounded-full border px-1 py-0.5 text-xs',
                      proficient
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-border text-muted hover:border-accent',
                    )}
                  >
                    Save {signed(mod(a) + (proficient ? pb : 0))}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Tap “Save” for the saving throws it is proficient in.
          </p>
        </Section>

        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SKILLS).map(([skill, ability]) => {
              const level = form.skills[skill] ?? 0;
              const next = ((level + 1) % 3) as 0 | 1 | 2;
              return (
                <button
                  key={skill}
                  type="button"
                  aria-label={`${cap(skill)}: ${level === 2 ? 'expertise' : level === 1 ? 'proficient' : 'not proficient'}`}
                  onClick={() => {
                    const skills = { ...form.skills };
                    if (next === 0) Reflect.deleteProperty(skills, skill);
                    else skills[skill] = next;
                    set('skills', skills);
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-sm',
                    level === 2
                      ? 'border-accent bg-accent text-accent-fg'
                      : level === 1
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-border text-muted hover:border-accent',
                  )}
                >
                  {cap(skill)} {level > 0 && signed(abilityMod(form.scores[ability]) + pb * level)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">Tap once for proficiency, twice for expertise.</p>
        </Section>

        <Section title="Senses and languages">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SENSES.map((s) => (
              <NumberField
                key={s}
                label={`${cap(s)} (ft.)`}
                value={form.senses[s]}
                onChange={(v) => {
                  set('senses', { ...form.senses, [s]: v });
                }}
              />
            ))}
          </div>
          <p className="text-sm text-muted">Passive Perception {passivePerception(form)}</p>
          <Text
            label="Languages"
            placeholder="Common, Goblin"
            value={form.languages}
            onChange={(v) => {
              set('languages', v);
            }}
          />
        </Section>

        <Section title="Resistances and immunities">
          {(
            [
              ['resist', 'Resistant to'],
              ['immune', 'Immune to'],
              ['vulnerable', 'Vulnerable to'],
            ] as const
          ).map(([key, label]) => (
            <Chips
              key={key}
              label={label}
              options={DAMAGE_NAMES}
              selected={form[key]}
              onToggle={(v) => {
                toggle(key, v);
              }}
            />
          ))}
          <Chips
            label="Immune to conditions"
            options={CONDITION_NAMES}
            selected={form.conditionImmune}
            onToggle={(v) => {
              toggle('conditionImmune', v);
            }}
          />
        </Section>

        <Features
          title="Traits"
          what="trait"
          list={form.traits}
          onChange={(v) => {
            set('traits', v);
          }}
        />
        <Features
          title="Actions"
          what="action"
          list={form.actions}
          onChange={(v) => {
            set('actions', v);
          }}
          attacks={{ form, edition: pack.edition }}
        />
        <Features
          title="Bonus actions"
          what="bonus action"
          list={form.bonusActions}
          onChange={(v) => {
            set('bonusActions', v);
          }}
          attacks={{ form, edition: pack.edition }}
        />
        <Features
          title="Reactions"
          what="reaction"
          list={form.reactions}
          onChange={(v) => {
            set('reactions', v);
          }}
        />
        <Features
          title="Legendary actions"
          what="legendary action"
          list={form.legendary}
          onChange={(v) => {
            set('legendary', v);
          }}
          attacks={{ form, edition: pack.edition }}
          extra={
            form.legendary.length > 0 && (
              <NumberField
                label="Legendary actions per round"
                value={form.legendaryCount}
                onChange={(v) => {
                  set('legendaryCount', v ?? 3);
                }}
              />
            )
          }
        />

        <Section title="Spellcasting">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.spellcasting.on}
              onChange={(e) => {
                set('spellcasting', { ...form.spellcasting, on: e.target.checked });
              }}
            />
            It casts spells
          </label>
          {form.spellcasting.on && (
            <>
              <Grid>
                <Select
                  label="Spellcasting ability"
                  value={form.spellcasting.ability}
                  onChange={(v) => {
                    set('spellcasting', { ...form.spellcasting, ability: v as Ability });
                  }}
                  options={ABILITIES.map((a) => ({ id: a, label: ABILITY_NAME[a] }))}
                />
                <p className="self-end pb-2 text-sm text-muted sm:col-span-2">
                  Save DC {8 + pb + mod(form.spellcasting.ability)},{' '}
                  {signed(pb + mod(form.spellcasting.ability))} to hit
                </p>
              </Grid>
              <Text
                label="At will"
                placeholder="Mage Hand, Minor Illusion"
                value={form.spellcasting.atWill}
                onChange={(v) => {
                  set('spellcasting', { ...form.spellcasting, atWill: v });
                }}
              />
              {([1, 2, 3] as const).map((n) => (
                <Text
                  key={n}
                  label={`${String(n)}/day each`}
                  value={form.spellcasting.perDay[n]}
                  onChange={(v) => {
                    set('spellcasting', {
                      ...form.spellcasting,
                      perDay: { ...form.spellcasting.perDay, [n]: v },
                    });
                  }}
                />
              ))}
              <p className="text-xs text-muted">
                Spell names, separated by commas: they become links.
              </p>
            </>
          )}
        </Section>

        <Section title="Picture">
          <PictureField value={image} onChange={setImage} onError={setProblem} />
        </Section>

        {problem && (
          <p role="alert" className="rounded-md bg-sunken px-3 py-2 text-sm">
            {problem}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save creature'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      <aside
        aria-label="Preview"
        className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto"
      >
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Preview</p>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
          {image && (
            <img
              src={image}
              alt=""
              className="float-right mb-2 ml-3 max-h-40 w-28 rounded-md object-contain"
            />
          )}
          <h2 className="font-serif text-xl font-bold">{form.name.trim() || 'Unnamed creature'}</h2>
          <p className="mb-2 text-xs text-faint">{pack.name}</p>
          <EntityView type="monster" data={creature} edition={pack.edition} />
        </article>
      </aside>
    </div>
  );
}

function Chips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onToggle(o);
              }}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-sm',
                on
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-border text-muted hover:border-accent',
              )}
            >
              {cap(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A list of named blocks (traits, actions…), with an attack builder for actions. */
function Features({
  title,
  what,
  list,
  onChange,
  attacks,
  extra,
}: {
  title: string;
  what: string;
  list: Feature[];
  onChange: (list: Feature[]) => void;
  attacks?: { form: CreatureForm; edition: '2014' | '2024' };
  extra?: ReactNode;
}) {
  const [building, setBuilding] = useState<number | null>(null);
  const update = (i: number, patch: Partial<Feature>) => {
    onChange(list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  };
  return (
    <Section title={title}>
      {extra}
      {list.map((f, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Text
                label={`${cap(what)} ${String(i + 1)}`}
                value={f.name}
                placeholder={what === 'trait' ? 'Pack Tactics' : 'Scimitar'}
                onChange={(v) => {
                  update(i, { name: v });
                }}
              />
            </div>
            {attacks && (
              <Button
                type="button"
                variant="ghost"
                aria-label={`Build an attack for ${what} ${String(i + 1)}`}
                title="Build an attack"
                onClick={() => {
                  setBuilding(building === i ? null : i);
                }}
              >
                <Swords className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove ${what} ${String(i + 1)}`}
              onClick={() => {
                onChange(list.filter((_, j) => j !== i));
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {attacks && building === i && (
            <AttackBuilder
              form={attacks.form}
              edition={attacks.edition}
              onWrite={(sentence) => {
                const paragraphs = f.text.split(/\n\s*\n/);
                const rest = ATTACK_LABEL.test(paragraphs[0] ?? '')
                  ? paragraphs.slice(1)
                  : paragraphs.filter(Boolean);
                update(i, { text: [sentence, ...rest].join('\n\n') });
                setBuilding(null);
              }}
            />
          )}
          <TextArea
            label={`What ${what} ${String(i + 1)} does`}
            hint="Write it as in a statblock: bonuses, damage, DCs and conditions become rolls and links."
            value={f.text}
            onChange={(v) => {
              update(i, { text: v });
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        onClick={() => {
          onChange([...list, { name: '', text: '' }]);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add {/^[aeiou]/i.test(what) ? 'an' : 'a'} {what}
      </Button>
    </Section>
  );
}

/** Works out an attack's bonus and damage and writes the sentence for it. */
function AttackBuilder({
  form,
  edition,
  onWrite,
}: {
  form: CreatureForm;
  edition: '2014' | '2024';
  onWrite: (sentence: string) => void;
}) {
  const [spec, setSpec] = useState<AttackSpec>({
    kind: 'melee',
    ability: abilityMod(form.scores.dex) > abilityMod(form.scores.str) ? 'dex' : 'str',
    reach: '5',
    range: '80/320',
    damage: '1d6',
    damageType: 'slashing',
    extraDamage: '',
    extraType: 'fire',
  });
  const patch = (p: Partial<AttackSpec>) => {
    setSpec((s) => ({ ...s, ...p }));
  };
  const sentence = attackText(form, spec, edition);
  return (
    <div className="space-y-3 rounded-md bg-sunken p-3">
      <Grid>
        <Select
          label="Attack"
          value={spec.kind}
          onChange={(v) => {
            patch({ kind: v as AttackSpec['kind'] });
          }}
          options={[
            { id: 'melee', label: 'Melee' },
            { id: 'ranged', label: 'Ranged' },
            { id: 'both', label: 'Melee or ranged' },
          ]}
        />
        <Select
          label="Using"
          value={spec.ability}
          onChange={(v) => {
            patch({ ability: v as Ability });
          }}
          options={ABILITIES.map((a) => ({ id: a, label: ABILITY_NAME[a] }))}
        />
        {spec.kind !== 'ranged' ? (
          <Text
            label="Reach (ft.)"
            value={spec.reach}
            onChange={(v) => {
              patch({ reach: v });
            }}
          />
        ) : (
          <span />
        )}
        {spec.kind !== 'melee' && (
          <Text
            label="Range (ft.)"
            value={spec.range}
            onChange={(v) => {
              patch({ range: v });
            }}
          />
        )}
        <Text
          label="Damage dice"
          value={spec.damage}
          onChange={(v) => {
            patch({ damage: v });
          }}
        />
        <Select
          label="Damage type"
          value={spec.damageType}
          onChange={(v) => {
            patch({ damageType: v });
          }}
          options={DAMAGE_NAMES.map((d) => ({ id: d, label: cap(d) }))}
        />
        <Text
          label="Extra damage (optional)"
          placeholder="2d6"
          value={spec.extraDamage}
          onChange={(v) => {
            patch({ extraDamage: v });
          }}
        />
        {spec.extraDamage.trim() && (
          <Select
            label="Extra damage type"
            value={spec.extraType}
            onChange={(v) => {
              patch({ extraType: v });
            }}
            options={DAMAGE_NAMES.map((d) => ({ id: d, label: cap(d) }))}
          />
        )}
      </Grid>
      <p className="text-sm">{sentence}</p>
      <Button
        type="button"
        size="sm"
        variant="primary"
        onClick={() => {
          onWrite(sentence);
        }}
      >
        Use this attack
      </Button>
    </div>
  );
}
