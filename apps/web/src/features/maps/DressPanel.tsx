/** Dress: recipe cards, the rules of a dressing, and the settings of a dressing you picked. */
import { Button, cn } from '@boh/ui';
import { ChevronDown, ChevronRight, Dices, Layers, Plus, Shuffle, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShowDrawn } from '../../app/maps/artPrefs';
import {
  fromPacks,
  hasGlyphs,
  pickAgain,
  RECIPE_GROUPS,
  RECIPES,
  recipeById,
  type Recipe,
} from '../../app/maps/dress/recipes';
import { settingsFor } from '../../app/maps/dress/settings';
import { glyphRef, GLYPHS, isGlyphRef } from '../../app/maps/glyphs';
import type { DressPlace, DressRule, MapItem } from '../../app/maps/model';
import { displayName, parsePackRef } from '../../app/maps/packModel';
import { usePacks } from '../../app/maps/packs';
import { bakeScatter, type ScatterItem } from '../../app/maps/scatterDoc';
import { TERRAINS, type TerrainRef } from '../../app/maps/terrain';
import { stampUnit } from '../../app/maps/units';
import { Section, ShapePicker } from './PanelParts';
import { type MapPanelsProps, field } from './panelTypes';

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  aria,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  aria?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}: {display ?? value}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={aria ?? label}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-full"
      />
    </label>
  );
}

const pieceName = (ref: string): string => {
  if (isGlyphRef(ref)) return GLYPHS.find((g) => glyphRef(g.id) === ref)?.name ?? ref;
  const parsed = parsePackRef(ref);
  return displayName(parsed ? parsed.path : ref);
};

const PLACES: { id: DressPlace; name: string; area: boolean; along: boolean }[] = [
  { id: 'area', name: 'Fill the area', area: true, along: false },
  { id: 'along', name: 'Along the line or edge', area: true, along: true },
  { id: 'edge', name: 'Near the edge', area: true, along: false },
  { id: 'cluster', name: 'In clumps', area: true, along: false },
  { id: 'grid', name: 'In rows', area: true, along: false },
];

/** "Rotation of pieces" for the first rule, "Rotation of pieces (rule 2)" for the others. */
const label = (base: string, r: number) => (r === 0 ? base : `${base} (rule ${String(r + 1)})`);

/** One rule: what it lays down, where, and how. */
function RuleEditor({
  rule,
  index,
  mode,
  stamp,
  canRemove,
  onChange,
  onRemove,
}: {
  rule: DressRule;
  index: number;
  mode: 'area' | 'along';
  stamp: string | null;
  canRemove: boolean;
  onChange: (patch: Partial<DressRule>) => void;
  onRemove: () => void;
}) {
  const drawn = useShowDrawn();
  const has = (ref: string) => rule.pieces.some((p) => p.ref === ref);
  const setPieces = (pieces: DressRule['pieces']) => {
    if (pieces.length > 0) onChange({ pieces });
  };
  const along = rule.place === 'along';
  const area = !along && mode === 'area';
  return (
    <fieldset
      aria-label={`Rule ${String(index + 1)}`}
      className="space-y-1.5 rounded-md border border-border p-2"
    >
      <legend className="flex w-full items-center justify-between px-1 text-sm font-medium">
        Rule {index + 1}
        {canRemove && (
          <button
            type="button"
            aria-label={`Remove rule ${String(index + 1)}`}
            onClick={onRemove}
            className="rounded p-0.5 text-muted hover:bg-sunken"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </legend>
      <ul aria-label={label('Pieces', index)} className="space-y-1">
        {rule.pieces.map((p) => (
          <li key={p.ref} className="flex items-center gap-1 text-xs">
            <span className="min-w-0 flex-1 truncate" title={pieceName(p.ref)}>
              {pieceName(p.ref)}
            </span>
            <input
              type="number"
              min={0.25}
              max={4}
              step={0.05}
              value={p.scale ?? 1}
              aria-label={`Size of ${pieceName(p.ref)}`}
              title="Its own size (×)"
              onChange={(e) => {
                const scale = Math.min(4, Math.max(0.25, Number(e.target.value) || 1));
                setPieces(
                  rule.pieces.map((x) => {
                    if (x.ref !== p.ref) return x;
                    const { scale: _s, ...rest } = x;
                    return scale === 1 ? rest : { ...rest, scale };
                  }),
                );
              }}
              className="w-14 rounded border border-border bg-surface px-1 py-0.5"
            />
            <button
              type="button"
              aria-label={`Remove ${pieceName(p.ref)} from the mix`}
              disabled={rule.pieces.length <= 1}
              onClick={() => {
                setPieces(rule.pieces.filter((x) => x.ref !== p.ref));
              }}
              className="rounded p-0.5 text-muted hover:bg-sunken disabled:opacity-40"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div
        className={cn('flex flex-wrap gap-1', !drawn && 'hidden')}
        role="group"
        aria-label={label('Built-in pieces', index)}
      >
        {GLYPHS.map((g) => {
          const ref = glyphRef(g.id);
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={has(ref)}
              onClick={() => {
                if (!has(ref)) setPieces([...rule.pieces, { ref, weight: 1 }]);
                else setPieces(rule.pieces.filter((x) => x.ref !== ref));
              }}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs',
                has(ref) ? 'border-accent bg-accent-soft font-medium' : 'border-border text-muted',
              )}
            >
              {g.name}
            </button>
          );
        })}
      </div>
      {stamp && !has(stamp) && (
        <Button
          variant="ghost"
          onClick={() => {
            setPieces([...rule.pieces, { ref: stamp, weight: 2 }]);
          }}
        >
          Add the stamp picked in Stamps
        </Button>
      )}
      <label className="block text-sm">
        Where
        <select
          value={rule.place}
          aria-label={label('Where pieces go', index)}
          onChange={(e) => {
            onChange({ place: e.target.value as DressPlace });
          }}
          className={field}
        >
          {PLACES.filter((p) => (mode === 'area' ? p.area : p.along)).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label={rule.place === 'grid' ? 'Row spacing' : 'Spacing'}
        aria={label('Spacing', index)}
        value={rule.spacing}
        min={4}
        max={400}
        step={1}
        onChange={(spacing) => {
          onChange({ spacing });
        }}
      />
      <Slider
        label="Overlap"
        aria={label('Overlap', index)}
        value={rule.overlap ?? 0}
        min={0}
        max={0.8}
        step={0.05}
        display={`${String(Math.round((rule.overlap ?? 0) * 100))}%`}
        onChange={(overlap) => {
          onChange({ overlap });
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Smallest"
          aria={label('Smallest', index)}
          value={rule.sizeMin}
          min={6}
          max={300}
          step={1}
          onChange={(sizeMin) => {
            onChange({ sizeMin, sizeMax: Math.max(sizeMin, rule.sizeMax) });
          }}
        />
        <Slider
          label="Largest"
          aria={label('Largest', index)}
          value={rule.sizeMax}
          min={6}
          max={400}
          step={1}
          onChange={(sizeMax) => {
            onChange({ sizeMax, sizeMin: Math.min(sizeMax, rule.sizeMin) });
          }}
        />
      </div>
      {area && rule.place !== 'grid' && (
        <Slider
          label="Groves and clearings"
          aria={label('Groves and clearings', index)}
          value={rule.cluster}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(rule.cluster * 100))}%`}
          onChange={(cluster) => {
            onChange({ cluster });
          }}
        />
      )}
      {rule.place === 'edge' && (
        <Slider
          label="How far in from the edge"
          aria={label('How far in from the edge', index)}
          value={rule.depth ?? rule.spacing * 2}
          min={4}
          max={600}
          step={1}
          onChange={(depth) => {
            onChange({ depth });
          }}
        />
      )}
      {(along || rule.place === 'grid') && (
        <Slider
          label="Wandering"
          aria={label('Wandering', index)}
          value={rule.jitter}
          min={0}
          max={1}
          step={0.05}
          display={`${String(Math.round(rule.jitter * 100))}%`}
          onChange={(jitter) => {
            onChange({ jitter });
          }}
        />
      )}
      {along && (
        <>
          <label className="block text-sm">
            Stand
            <select
              value={rule.sides}
              aria-label={label('Which side of the line', index)}
              onChange={(e) => {
                onChange({ sides: e.target.value as DressRule['sides'] });
              }}
              className={field}
            >
              <option value="center">On the line</option>
              <option value="both">Both sides</option>
              <option value="left">Left side</option>
              <option value="right">Right side</option>
            </select>
          </label>
          {rule.sides !== 'center' && (
            <Slider
              label="Distance from the line"
              aria={label('Distance from the line', index)}
              value={rule.offset}
              min={0}
              max={300}
              step={1}
              onChange={(offset) => {
                onChange({ offset });
              }}
            />
          )}
        </>
      )}
      <Slider
        label={along ? 'Thinner towards the ends' : 'Thinner towards the edge'}
        aria={label('Falloff', index)}
        value={rule.falloff ?? 0}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round((rule.falloff ?? 0) * 100))}%`}
        onChange={(falloff) => {
          onChange({ falloff });
        }}
      />
      <label className="block text-sm">
        Snap
        <select
          value={String(rule.snap ?? 0)}
          aria-label={label('Snap to the grid', index)}
          onChange={(e) => {
            onChange({ snap: Number(e.target.value) });
          }}
          className={field}
        >
          <option value="0">Free</option>
          <option value="1">Middle of each square</option>
          <option value="2">Middle of each half square</option>
        </select>
      </label>
      <label className="block text-sm">
        Turned
        <select
          value={rule.rotation}
          aria-label={label('Rotation of pieces', index)}
          onChange={(e) => {
            onChange({ rotation: e.target.value as DressRule['rotation'] });
          }}
          className={field}
        >
          <option value="none">Upright</option>
          <option value="random">Any way (rocks, top-down pictures)</option>
          <option value="quarter">Square on (furniture)</option>
          {along && <option value="along">Along the line</option>}
        </select>
      </label>
      {rule.rotation === 'random' && (
        <>
          <Slider
            label="Turn from"
            aria={label('Turn from', index)}
            value={rule.rotMin ?? 0}
            min={0}
            max={360}
            step={5}
            display={`${String(rule.rotMin ?? 0)}°`}
            onChange={(rotMin) => {
              onChange({ rotMin, rotMax: Math.max(rotMin, rule.rotMax ?? 360) });
            }}
          />
          <Slider
            label="Turn to"
            aria={label('Turn to', index)}
            value={rule.rotMax ?? 360}
            min={0}
            max={360}
            step={5}
            display={`${String(rule.rotMax ?? 360)}°`}
            onChange={(rotMax) => {
              onChange({ rotMax, rotMin: Math.min(rotMax, rule.rotMin ?? 0) });
            }}
          />
        </>
      )}
      <Slider
        label="Colour variation"
        aria={label('Colour variation', index)}
        value={rule.tint ?? 0}
        min={0}
        max={1}
        step={0.05}
        display={`${String(Math.round((rule.tint ?? 0) * 100))}%`}
        onChange={(tint) => {
          onChange({ tint });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rule.flip === true}
          onChange={(e) => {
            onChange({ flip: e.target.checked });
          }}
        />
        Mirror some at random
      </label>
      {index > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rule.apart === true}
            onChange={(e) => {
              onChange({ apart: e.target.checked });
            }}
          />
          Keep clear of the rules above
        </label>
      )}
    </fieldset>
  );
}

interface Placement {
  avoid: 'auto' | 'none';
  overPaths?: boolean | undefined;
  onlyOn?: TerrainRef[] | undefined;
}

/** Where a whole dressing may stand. */
function PlacementControls({
  value,
  onChange,
}: {
  value: Placement;
  onChange: (patch: Partial<Placement>) => void;
}) {
  return (
    <>
      <label className="block text-sm">
        Only on
        <select
          value={value.onlyOn?.[0] ?? ''}
          aria-label="Only on this ground"
          onChange={(e) => {
            const id = e.target.value;
            onChange({ onlyOn: id ? [id as TerrainRef] : undefined });
          }}
          className={field}
        >
          <option value="">Any ground</option>
          {TERRAINS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.avoid === 'auto'}
          onChange={(e) => {
            onChange({ avoid: e.target.checked ? 'auto' : 'none' });
          }}
          className="mt-1"
        />
        Keep clear of roads, rivers, buildings and water (it follows them when they move)
      </label>
      {value.avoid === 'auto' && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.overPaths === true}
            onChange={(e) => {
              onChange({ overPaths: e.target.checked });
            }}
            className="mt-1"
          />
          But stand on roads and rivers too
        </label>
      )}
    </>
  );
}

/** Every rule of a dressing, with Add a rule. */
function RulesEditor({
  rules,
  mode,
  stamp,
  onChange,
}: {
  rules: DressRule[];
  mode: 'area' | 'along';
  stamp: string | null;
  onChange: (rules: DressRule[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rules.map((rule, i) => (
        <RuleEditor
          key={i}
          rule={rule}
          index={i}
          mode={mode}
          stamp={stamp}
          canRemove={rules.length > 1}
          onChange={(patch) => {
            onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
          }}
          onRemove={() => {
            onChange(rules.filter((_, k) => k !== i));
          }}
        />
      ))}
      <Button
        variant="ghost"
        onClick={() => {
          const last = rules[rules.length - 1];
          if (!last) return;
          const { from: _f, ...copy } = last;
          onChange([
            ...rules,
            {
              ...copy,
              pieces: stamp ? [{ ref: stamp, weight: 1 }] : copy.pieces.map((p) => ({ ...p })),
              apart: true,
            },
          ]);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a rule
      </Button>
    </div>
  );
}

/** The recipes the packs (or the drawn art) can make, in their groups. */
function RecipeCards({
  current,
  onPick,
}: {
  current: string;
  onPick: (recipe: Recipe, fromPack: boolean) => void;
}) {
  const drawn = useShowDrawn();
  const { entries } = usePacks();
  const usable = useMemo(
    () =>
      RECIPES.flatMap((r) => {
        const pack = !drawn && fromPacks(r, entries);
        return pack || (drawn && hasGlyphs(r)) ? [{ recipe: r, pack }] : [];
      }),
    [entries, drawn],
  );
  if (usable.length === 0)
    return (
      <p className="text-xs text-muted">
        Import an asset pack to dress the map with its trees, rocks and furniture.
      </p>
    );
  return (
    <div className="space-y-2">
      {RECIPE_GROUPS.map((group) => {
        const list = usable.filter((u) => u.recipe.group === group);
        if (list.length === 0) return null;
        return (
          <div key={group}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {group}
            </h3>
            <div
              role="radiogroup"
              aria-label={`${group} recipes`}
              className="grid grid-cols-2 gap-1"
            >
              {list.map(({ recipe, pack }) => (
                <button
                  key={recipe.id}
                  type="button"
                  role="radio"
                  aria-checked={current === recipe.id}
                  title={recipe.hint}
                  onClick={() => {
                    onPick(recipe, pack);
                  }}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-left text-sm',
                    current === recipe.id
                      ? 'border-accent bg-accent-soft font-medium'
                      : 'border-border text-muted hover:bg-sunken',
                  )}
                >
                  {recipe.name}
                  <span className="block text-[11px] font-normal text-muted">{recipe.hint}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A button that shows or hides the full rules. */
function AdvancedToggle({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        setOpen(!open);
      }}
      className="flex items-center gap-1 text-sm font-medium text-accent-ink"
    >
      {open ? (
        <ChevronDown className="h-4 w-4" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden />
      )}
      Advanced: the rules
    </button>
  );
}

/** The panel of the Dress tool: pick a recipe, adjust it, then draw where it goes. */
export function DressPanel({ scatter, setScatter, stamp, doc, draw, setDraw }: MapPanelsProps) {
  const drawn = useShowDrawn();
  const { entries } = usePacks();
  const [advanced, setAdvanced] = useState(false);
  const pick = (recipe: Recipe, pack: boolean) => {
    setScatter(
      settingsFor(
        recipe,
        entries,
        { unit: stampUnit(doc), drawn: !pack },
        { scale: scatter.scale, ...(scatter.single ? { single: true } : {}) },
      ),
    );
  };
  // With packs imported (and no drawn art asked for) the tool opens on the packs' forest.
  const onGlyphs = scatter.rules.every((r) => r.pieces.every((p) => isGlyphRef(p.ref)));
  const forest = recipeById('forest');
  const packForest = !drawn && forest !== undefined && fromPacks(forest, entries);
  useEffect(() => {
    if (packForest && onGlyphs) pick(forest, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packForest, onGlyphs]);
  const name = recipeById(scatter.recipe)?.name;
  return (
    <Section title="Dress">
      <RecipeCards current={scatter.recipe} onPick={pick} />
      <Slider
        label="Size of everything"
        value={scatter.scale}
        min={0.25}
        max={4}
        step={0.05}
        display={`×${scatter.scale.toFixed(2)}`}
        onChange={(scale) => {
          setScatter({ ...scatter, scale });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={scatter.single === true}
          onChange={(e) => {
            const { single: _s, ...rest } = scatter;
            setScatter(e.target.checked ? { ...rest, single: true } : rest);
          }}
        />
        One piece per click (a random one each time)
      </label>
      {scatter.mode === 'area' && !scatter.single && <ShapePicker draw={draw} setDraw={setDraw} />}
      <PlacementControls
        value={scatter}
        onChange={(patch) => {
          setScatter({ ...scatter, ...patch });
        }}
      />
      <AdvancedToggle open={advanced} setOpen={setAdvanced} />
      {advanced ? (
        <RulesEditor
          rules={scatter.rules}
          mode={scatter.mode}
          stamp={stamp}
          onChange={(rules) => {
            setScatter({ ...scatter, rules, recipe: 'custom' });
          }}
        />
      ) : (
        <p className="text-xs text-muted">
          {name ? `${name}: ` : ''}
          {scatter.rules.length} rule{scatter.rules.length === 1 ? '' : 's'},{' '}
          {scatter.rules.reduce((n, r) => n + r.pieces.length, 0)} pictures.
        </p>
      )}
      <p className="text-xs text-muted">
        {scatter.mode === 'area'
          ? 'Click the corners of the area to dress; double-click or Enter finishes, Escape cancels.'
          : 'Click along the line to follow; double-click or Enter finishes, Escape cancels.'}{' '}
        Or pick a shape, room or road with Select and press its Dress button.
      </p>
    </Section>
  );
}

/** The settings of a picked dressing: change its rules, roll again, pick again, or bake it. */
export function DressItemSettings({
  item,
  stamp,
  set,
  commit,
}: {
  item: ScatterItem;
  stamp: string | null;
  set: (change: (i: MapItem) => MapItem) => void;
  commit: MapPanelsProps['commit'];
}) {
  const { entries } = usePacks();
  const [advanced, setAdvanced] = useState(false);
  const change = (patch: Partial<ScatterItem>) => {
    set((i) => {
      if (i.kind !== 'scatter') return i;
      const { onlyOn, overPaths, ...rest } = { ...i, ...patch };
      // `undefined` and `false` clear a setting.
      return {
        ...rest,
        ...(onlyOn?.length ? { onlyOn } : {}),
        ...(overPaths ? { overPaths: true as const } : {}),
      };
    });
  };
  const fromRecipe = item.rules.some((r) => r.from);
  return (
    <>
      {(item.within ?? item.follow) && (
        <p className="text-xs text-muted">
          {item.within ? 'Dresses a shape or room' : 'Follows a road or river'}: reshape that, and
          this follows.
        </p>
      )}
      <PlacementControls
        value={item}
        onChange={(patch) => {
          change(patch as Partial<ScatterItem>);
        }}
      />
      <AdvancedToggle open={advanced} setOpen={setAdvanced} />
      {advanced && (
        <RulesEditor
          rules={item.rules}
          mode={item.mode}
          stamp={stamp}
          onChange={(rules) => {
            change({ rules });
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            set((i) =>
              i.kind === 'scatter' ? { ...i, seed: Math.floor(Math.random() * 1e9) } : i,
            );
          }}
        >
          <Dices className="h-4 w-4" aria-hidden /> Roll again
        </Button>
        {fromRecipe && entries.length > 0 && (
          <Button
            variant="ghost"
            title="Other pictures from the packs that fit the same rules"
            onClick={() => {
              const seed = Math.floor(Math.random() * 1e9);
              change({ rules: item.rules.map((r, k) => pickAgain(r, entries, seed + k)) });
            }}
          >
            <Shuffle className="h-4 w-4" aria-hidden /> Pick again
          </Button>
        )}
        <Button
          variant="ghost"
          title="Turn the pieces into loose stamps you can move one by one"
          onClick={() => {
            commit((d) => bakeScatter(d, item.id));
          }}
        >
          <Layers className="h-4 w-4" aria-hidden /> Bake into stamps
        </Button>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted">
        <Trash2 className="h-3 w-3" aria-hidden /> Remove deletes the whole dressing.
      </p>
    </>
  );
}
