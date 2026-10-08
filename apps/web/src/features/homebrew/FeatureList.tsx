import type { FeatureForm } from '@boh/data5e';
import { Button } from '@boh/ui';
import { Plus, Table2, X } from 'lucide-react';
import { NumberField, Section, Text, TextArea } from './fields';

/** Class or subclass features, by level: name and what each does. */
export function FeatureList({
  features,
  onChange,
  firstLevel = 1,
}: {
  features: readonly FeatureForm[];
  onChange: (features: FeatureForm[]) => void;
  /** Where a new subclass starts (3 for most). */
  firstLevel?: number;
}) {
  const change = (i: number, patch: Partial<FeatureForm>) => {
    onChange(features.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  return (
    <Section title="Features">
      {features.map((f, i) => (
        <div key={i} className="space-y-1 rounded-md border border-border p-2">
          <div className="flex gap-2">
            <div className="w-24">
              <NumberField
                label="Level"
                value={f.level}
                onChange={(v) => {
                  change(i, { level: Math.min(20, Math.max(1, v ?? 1)) });
                }}
              />
            </div>
            <div className="flex-1">
              <Text
                label={`Feature ${String(i + 1)}`}
                value={f.name}
                onChange={(v) => {
                  change(i, { name: v });
                }}
              />
            </div>
            <button
              type="button"
              aria-label={`Remove feature ${String(i + 1)}`}
              onClick={() => {
                onChange(features.filter((_, j) => j !== i));
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
              change(i, { text: v });
            }}
          />
          {f.original && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <Table2 className="h-3.5 w-3.5" aria-hidden /> Also has tables or lists, kept as they
              are.
            </p>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const last = features.at(-1)?.level ?? firstLevel - 1;
          onChange([
            ...features,
            { level: Math.min(20, Math.max(firstLevel, last + 1)), name: '', text: '' },
          ]);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a feature
      </Button>
    </Section>
  );
}
