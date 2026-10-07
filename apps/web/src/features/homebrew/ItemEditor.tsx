import {
  DAMAGE_TYPES,
  emptyItem,
  formToItem,
  isArmor,
  isWeapon,
  ITEM_KINDS,
  itemToForm,
  RARITIES,
  WEAPON_PROPERTIES,
  type ItemForm,
  type PackMeta,
  type RawEntity,
} from '@boh/data5e';
import { EntityView } from '@boh/renderer';
import { Button, cn } from '@boh/ui';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { shrinkImage } from './images';

const RECHARGE = [
  { id: '', label: 'Never' },
  { id: 'dawn', label: 'At dawn' },
  { id: 'dusk', label: 'At dusk' },
  { id: 'midnight', label: 'At midnight' },
] as const;

/**
 * An item made or changed with a form, shown as it will look in the compendium as you type.
 * `base` is the item being edited: fields the form does not show are kept.
 */
export function ItemEditor({
  pack,
  base,
  image: initialImage,
  onSave,
  onCancel,
}: {
  pack: PackMeta;
  base: RawEntity | null;
  /** The item's picture (a data URL or a web address), if it has one. */
  image: string | null;
  onSave: (item: RawEntity, image: string | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ItemForm>(() => (base ? itemToForm(base) : emptyItem()));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(initialImage);
  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const item = { ...formToItem(form, base ?? {}), source: pack.id };
  const weapon = isWeapon(form.kind);
  const armor = isArmor(form.kind);

  const save = async () => {
    if (!form.name.trim()) {
      setProblem('Give the item a name.');
      return;
    }
    setSaving(true);
    setProblem(await onSave(item, image));
    setSaving(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <form
        aria-label="Item"
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
              label="Kind"
              value={form.kind}
              onChange={(v) => {
                set('kind', v as ItemForm['kind']);
              }}
              options={ITEM_KINDS.map((k) => ({ id: k.id, label: k.label }))}
            />
            <Select
              label="Rarity"
              value={form.rarity}
              onChange={(v) => {
                set('rarity', v as ItemForm['rarity']);
              }}
              options={RARITIES.map((r) => ({
                id: r,
                label: r === 'none' ? 'Not magical' : cap(r),
              }))}
            />
          </Grid>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.attune}
              onChange={(e) => {
                set('attune', e.target.checked);
              }}
            />
            Requires attunement
          </label>
          {form.attune && (
            <Text
              label="Who can attune (optional)"
              placeholder="by a wizard"
              value={form.attuneBy}
              onChange={(v) => {
                set('attuneBy', v);
              }}
            />
          )}
        </Section>

        {weapon && (
          <Section title="Weapon">
            <Grid>
              <Select
                label="Category"
                value={form.weaponCategory}
                onChange={(v) => {
                  set('weaponCategory', v as ItemForm['weaponCategory']);
                }}
                options={[
                  { id: 'simple', label: 'Simple' },
                  { id: 'martial', label: 'Martial' },
                ]}
              />
              <Text
                label="Damage"
                placeholder="1d8"
                value={form.damage}
                onChange={(v) => {
                  set('damage', v);
                }}
              />
              <Select
                label="Damage type"
                value={form.damageType}
                onChange={(v) => {
                  set('damageType', v as ItemForm['damageType']);
                }}
                options={[
                  { id: '', label: '—' },
                  ...Object.entries(DAMAGE_TYPES).map(([id, label]) => ({ id, label: cap(label) })),
                ]}
              />
            </Grid>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Properties</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(WEAPON_PROPERTIES).map(([id, label]) => {
                  const on = form.properties.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        set(
                          'properties',
                          on ? form.properties.filter((p) => p !== id) : [...form.properties, id],
                        );
                      }}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-sm',
                        on
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-border hover:border-accent',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Grid>
              {form.properties.includes('V') && (
                <Text
                  label="Two-handed damage"
                  placeholder="1d10"
                  value={form.versatile}
                  onChange={(v) => {
                    set('versatile', v);
                  }}
                />
              )}
              {(form.kind === 'weapon-ranged' ||
                form.properties.includes('T') ||
                form.properties.includes('A')) && (
                <Text
                  label="Range (feet)"
                  placeholder="20/60"
                  value={form.range}
                  onChange={(v) => {
                    set('range', v);
                  }}
                />
              )}
            </Grid>
          </Section>
        )}

        {armor && (
          <Section title={form.kind === 'shield' ? 'Shield' : 'Armor'}>
            <Grid>
              <NumberField
                label={form.kind === 'shield' ? 'AC bonus' : 'Armor Class'}
                value={form.ac}
                onChange={(v) => {
                  set('ac', v);
                }}
              />
              {form.kind === 'armor-heavy' && (
                <NumberField
                  label="Strength needed"
                  value={form.strength}
                  onChange={(v) => {
                    set('strength', v);
                  }}
                />
              )}
            </Grid>
            {form.kind !== 'shield' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.stealth}
                  onChange={(e) => {
                    set('stealth', e.target.checked);
                  }}
                />
                Disadvantage on Stealth checks
              </label>
            )}
          </Section>
        )}

        <Section title="Magic">
          <Grid>
            {(weapon || armor || form.kind === 'ammunition') && (
              <Select
                label={armor ? 'Bonus to AC' : 'Bonus to attacks and damage'}
                value={String(form.bonus)}
                onChange={(v) => {
                  set('bonus', Number(v));
                }}
                options={[0, 1, 2, 3].map((n) => ({
                  id: String(n),
                  label: n ? `+${String(n)}` : 'None',
                }))}
              />
            )}
            <NumberField
              label="Charges"
              value={form.charges}
              onChange={(v) => {
                set('charges', v);
              }}
            />
            {form.charges !== null && (
              <Select
                label="Charges come back"
                value={form.recharge}
                onChange={(v) => {
                  set('recharge', v);
                }}
                options={RECHARGE.map((r) => ({ id: r.id, label: r.label }))}
              />
            )}
          </Grid>
        </Section>

        <Section title="Weight and value">
          <Grid>
            <NumberField
              label="Weight (lb.)"
              value={form.weight}
              onChange={(v) => {
                set('weight', v);
              }}
            />
            <NumberField
              label="Value (gp)"
              value={form.valueGp}
              onChange={(v) => {
                set('valueGp', v);
              }}
            />
          </Grid>
        </Section>

        <Section title="Picture">
          <PictureField value={image} onChange={setImage} onError={setProblem} />
        </Section>

        <Section title="Description">
          <TextArea
            label="What it is and what it does"
            hint="Leave a blank line between paragraphs. Dice like 2d6 become rolls."
            value={form.description}
            onChange={(v) => {
              set('description', v);
            }}
          />
          {form.abilities.map((a, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Text
                    label={`Ability ${String(i + 1)}`}
                    placeholder="Flare"
                    value={a.name}
                    onChange={(v) => {
                      set(
                        'abilities',
                        form.abilities.map((x, j) => (j === i ? { ...x, name: v } : x)),
                      );
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove ability ${String(i + 1)}`}
                  onClick={() => {
                    set(
                      'abilities',
                      form.abilities.filter((_, j) => j !== i),
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <TextArea
                label={`What ability ${String(i + 1)} does`}
                value={a.text}
                onChange={(v) => {
                  set(
                    'abilities',
                    form.abilities.map((x, j) => (j === i ? { ...x, text: v } : x)),
                  );
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            onClick={() => {
              set('abilities', [...form.abilities, { name: '', text: '' }]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add an ability
          </Button>
        </Section>

        {problem && (
          <p role="alert" className="rounded-md bg-sunken px-3 py-2 text-sm">
            {problem}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      <aside aria-label="Preview" className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Preview</p>
        <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
          {image && (
            <img
              src={image}
              alt=""
              className="float-right mb-2 ml-3 max-h-40 w-28 rounded-md object-contain sm:w-36"
            />
          )}
          <h2 className="font-serif text-xl font-bold">{form.name.trim() || 'Unnamed item'}</h2>
          <p className="mb-2 text-xs text-faint">{pack.name}</p>
          <EntityView type="item" data={item} edition={pack.edition} />
        </article>
      </aside>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <legend className="px-1 font-serif font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-3">{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={inputClass}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step="any"
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value === '' ? null : Number(e.target.value));
        }}
        className={inputClass}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; label: string }[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={5}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** An optional picture: a file from the device (shrunk) or a web address. */
function PictureField({
  value,
  onChange,
  onError,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  onError: (message: string) => void;
}) {
  const id = useId();
  const isLink = value !== null && /^https?:/i.test(value);
  return (
    <div className="space-y-3">
      {value ? (
        <img
          src={value}
          alt=""
          className="max-h-48 rounded-md border border-border object-contain"
        />
      ) : (
        <p className="text-sm text-muted">Optional: shown beside the item on its page.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-sunken">
          <ImagePlus className="h-4 w-4" aria-hidden />{' '}
          {value ? 'Change picture' : 'Choose a picture'}
          <input
            type="file"
            accept="image/*"
            aria-label="Picture file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) {
                void shrinkImage(file)
                  .then(onChange)
                  .catch(() => {
                    onError('That picture could not be read.');
                  });
              }
            }}
          />
        </label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onChange(null);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </Button>
        )}
      </div>
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          Or a picture from the web
        </label>
        <input
          id={id}
          type="url"
          placeholder="https://…"
          value={isLink ? value : ''}
          onChange={(e) => {
            onChange(e.target.value.trim() || null);
          }}
          className={inputClass}
        />
      </div>
    </div>
  );
}
