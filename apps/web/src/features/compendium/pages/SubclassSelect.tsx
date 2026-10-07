import type { SubclassSummary } from '@boh/data5e';
import { cn } from '@boh/ui';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSourceList } from '../../../app/data/sourceList';
import { disabledSourceIds, useSourcePrefs } from '../../../app/data/sourcePrefs';
import { LegacyBadge } from '../../../app/lists/LegacyBadge';

/** Pick the subclass whose features appear on the class page. */
export function SubclassSelect({
  title,
  subclasses,
  selected,
  onSelect,
}: {
  /** The class's name for subclasses: "Fighter Subclass", "Arcane Tradition". */
  title: string;
  subclasses: readonly SubclassSummary[];
  selected: string | undefined;
  onSelect: (key: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const { sources, load } = useSourceList();
  const overrides = useSourcePrefs((s) => s.overrides);
  useEffect(() => {
    void load();
  }, [load]);
  const sourceName = (id: string) =>
    sources.find((s) => s.id.toLowerCase() === id.toLowerCase())?.name ?? id;
  // Sources turned off in Settings are hidden everywhere, subclasses included.
  const disabled = new Set(disabledSourceIds(sources, overrides).map((s) => s.toLowerCase()));
  const shown = subclasses.filter(
    (s) => !disabled.has(s.source.toLowerCase()) || s.key === selected,
  );
  const current = subclasses.find((s) => s.key === selected);
  const groups: [string, SubclassSummary[]][] = [
    ['Current', shown.filter((s) => !s.legacy)],
    ['Legacy', shown.filter((s) => s.legacy)],
  ];
  const pick = (key: string | undefined) => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${title}: ${current?.name ?? 'none chosen'}`}
        className={cn(
          'flex h-11 w-full max-w-md items-center gap-2 rounded-md border bg-surface px-3 text-left',
          current ? 'border-accent' : 'border-border hover:border-border-strong',
        )}
      >
        <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          {title}
        </span>
        <span className={cn('min-w-0 flex-1 truncate font-medium', !current && 'text-faint')}>
          {current?.name ?? `Choose ${/^[aeiou]/i.test(title) ? 'an' : 'a'} ${title.toLowerCase()}`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          aria-label={`${title} list`}
          className="z-50 max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-card"
        >
          <button
            type="button"
            onClick={() => {
              pick(undefined);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2"
          >
            <span className="w-4">{!current && <Check className="h-4 w-4" aria-hidden />}</span>
            Class features only
          </button>
          {groups.map(([label, list]) =>
            list.length === 0 ? null : (
              <div key={label} role="group" aria-label={label}>
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {label}
                </p>
                {list.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      pick(s.key);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="w-4">
                      {s.key === selected && <Check className="h-4 w-4 text-accent" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    {s.legacy && <LegacyBadge />}
                    <span className="shrink-0 text-xs text-faint" title={sourceName(s.source)}>
                      {s.source}
                    </span>
                  </button>
                ))}
              </div>
            ),
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
