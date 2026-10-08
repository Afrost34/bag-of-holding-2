import { Button, cn } from '@boh/ui';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  addPinCategory,
  PIN_CATEGORY_COLORS,
  PIN_COLOR,
  removePinCategory,
  updatePinCategory,
  type MapDoc,
  type MapItem,
} from '../../app/maps/model';
import { PIN_ICONS, pinIcon } from '../../app/maps/pinIcons';

const field =
  'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none';

/** A grid of pin icons to pick from. */
export function IconPicker({
  value,
  onPick,
  label,
}: {
  value: string | null;
  onPick: (id: string) => void;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = PIN_ICONS.filter(
    (i) => !q || i.label.toLowerCase().includes(q) || i.id.includes(q),
  );
  return (
    <div className="space-y-1">
      <input
        type="search"
        value={query}
        placeholder="Find an icon"
        aria-label={`${label}: find an icon`}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        className={field}
      />
      <div
        role="radiogroup"
        aria-label={label}
        className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto"
      >
        {shown.map((i) => (
          <button
            key={i.id}
            type="button"
            role="radio"
            aria-checked={value === i.id}
            aria-label={i.label}
            title={i.label}
            onClick={() => {
              onPick(i.id);
            }}
            className={cn(
              'flex aspect-square items-center justify-center rounded-md border',
              value === i.id
                ? 'border-accent bg-accent-soft'
                : 'border-transparent hover:bg-sunken',
            )}
          >
            <i.Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/** The map's kinds of pins: name, icon, colour, shown or not. */
export function PinCategories({
  doc,
  commit,
}: {
  doc: MapDoc;
  commit: (change: (d: MapDoc) => MapDoc) => void;
}) {
  const categories = doc.pinCategories ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const l of doc.layers)
    for (const i of l.items)
      if (i.kind === 'pin' && i.category) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  return (
    <section aria-label="Pin categories" className="space-y-2">
      <h3 className="font-serif text-sm font-bold">Pin categories</h3>
      <p className="text-xs text-muted">
        Kinds of places (cities, dungeons, taverns…): their pins take the category’s icon and
        colour, and can be hidden together.
      </p>
      <ul className="space-y-1">
        {categories.map((c) => {
          const Icon = pinIcon(c.icon)?.Icon;
          return (
            <li key={c.id} className="rounded-md border border-border">
              <div className="flex items-center gap-2 px-2 py-1">
                <button
                  type="button"
                  aria-expanded={open === c.id}
                  aria-label={`Edit ${c.name}`}
                  onClick={() => {
                    setOpen(open === c.id ? null : c.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: c.color }}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <span
                    className={cn('truncate font-medium', c.hidden && 'text-muted line-through')}
                  >
                    {c.name}
                  </span>
                  <span className="text-xs text-faint">{counts.get(c.id) ?? 0}</span>
                </button>
                <button
                  type="button"
                  aria-label={c.hidden ? `Show ${c.name}` : `Hide ${c.name}`}
                  aria-pressed={!c.hidden}
                  onClick={() => {
                    commit((d) => updatePinCategory(d, c.id, { hidden: !c.hidden }));
                  }}
                  className="rounded p-1 text-muted hover:bg-sunken"
                >
                  {c.hidden ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {open === c.id && (
                <div className="space-y-2 border-t border-border p-2">
                  <label className="block text-sm">
                    Name
                    <input
                      value={c.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        commit((d) => updatePinCategory(d, c.id, { name }));
                      }}
                      className={field}
                    />
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Category colour"
                    className="flex flex-wrap gap-1"
                  >
                    {PIN_CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={c.color === color}
                        aria-label={color}
                        onClick={() => {
                          commit((d) => updatePinCategory(d, c.id, { color }));
                        }}
                        className={cn(
                          'h-6 w-6 rounded-full border-2',
                          c.color === color ? 'border-text' : 'border-transparent',
                        )}
                        style={{ background: color }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Another colour"
                      value={c.color}
                      onChange={(e) => {
                        const color = e.target.value;
                        commit((d) => updatePinCategory(d, c.id, { color }));
                      }}
                      className="h-6 w-8 cursor-pointer rounded border border-border bg-surface"
                    />
                  </div>
                  <IconPicker
                    label="Category icon"
                    value={c.icon}
                    onPick={(icon) => {
                      commit((d) => updatePinCategory(d, c.id, { icon }));
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      commit((d) => removePinCategory(d, c.id));
                      setOpen(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove the category
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        onClick={() => {
          const made = addPinCategory(doc, {
            name: 'New category',
            icon: 'map-pin',
            color:
              PIN_CATEGORY_COLORS[(categories.length + 1) % PIN_CATEGORY_COLORS.length] ??
              PIN_COLOR,
          });
          commit(() => made.doc);
          setOpen(made.id);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> New category
      </Button>
    </section>
  );
}

/** A pin's category and own icon (in the pin's settings). */
export function PinLook({
  doc,
  pin,
  set,
}: {
  doc: MapDoc;
  pin: Extract<MapItem, { kind: 'pin' }>;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const categories = doc.pinCategories ?? [];
  return (
    <>
      <label className="block text-sm">
        Category
        <select
          value={pin.category ?? ''}
          aria-label="Pin category"
          onChange={(e) => {
            const category = e.target.value;
            set((i) => {
              if (i.kind !== 'pin') return i;
              const { category: _c, ...rest } = i;
              return category ? { ...rest, category } : rest;
            });
          }}
          className={field}
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span>Icon</span>
          {pin.icon && (
            <button
              type="button"
              onClick={() => {
                set((i) => {
                  if (i.kind !== 'pin') return i;
                  const { icon: _i, ...rest } = i;
                  return rest;
                });
              }}
              className="text-xs text-link hover:underline"
            >
              Use the category’s
            </button>
          )}
        </div>
        <IconPicker
          label="Pin icon"
          value={pin.icon ?? null}
          onPick={(icon) => {
            set((i) => (i.kind === 'pin' ? { ...i, icon } : i));
          }}
        />
      </div>
    </>
  );
}
