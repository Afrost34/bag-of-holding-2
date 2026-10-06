import { tryParse, type RollMode } from '@boh/dice';
import { Button, cn, IconButton } from '@boh/ui';
import * as Popover from '@radix-ui/react-popover';
import { Dices, Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Breakdown, ModeBadge, OutcomeBadge } from './RollBreakdown';
import { useDice, useDiceSettings } from './store';

import { DICE, poolExpression, type Pool } from './pool';

export function DiceTray() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'roll' | 'log'>('roll');
  const [pool, setPool] = useState<Pool>({});
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<RollMode>('normal');
  const [custom, setCustom] = useState('');
  const { roll, log, clearLog } = useDice();
  const { threeD, setThreeD } = useDiceSettings();

  const expression = custom.trim() || poolExpression(pool, modifier);
  const valid = tryParse(expression) !== null;
  const hasDice = custom.trim() !== '' || DICE.some((f) => (pool[f] ?? 0) > 0);

  const doRoll = () => {
    if (!valid) return;
    void roll(
      { kind: (pool[20] ?? 0) === 1 && !custom ? 'd20' : 'dice', expression, label: 'Dice tray' },
      mode,
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Dice tray"
          className="fixed right-3 bottom-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-card hover:bg-accent-hover sm:right-4 sm:bottom-4 print:hidden"
        >
          <Dices className="h-6 w-6" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(94vw,22rem)] rounded-lg border border-border bg-surface shadow-card"
        >
          <div className="flex items-center border-b border-border px-2">
            {(['roll', 'log'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                }}
                className={cn(
                  'px-3 py-2 text-sm font-medium',
                  tab === t ? 'border-b-2 border-accent text-text' : 'text-muted hover:text-text',
                )}
              >
                {t === 'roll' ? 'Roll dice' : `Log (${String(log.length)})`}
              </button>
            ))}
            <span className="flex-1" />
            <Popover.Close asChild>
              <IconButton label="Close dice tray" size="icon-sm" icon={<X className="h-4 w-4" />} />
            </Popover.Close>
          </div>

          {tab === 'roll' ? (
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-4 gap-2">
                {DICE.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-label={`Add d${String(f)}`}
                    onClick={() => {
                      setCustom('');
                      setPool((p) => ({ ...p, [f]: (p[f] ?? 0) + 1 }));
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPool((p) => ({ ...p, [f]: Math.max(0, (p[f] ?? 0) - 1) }));
                    }}
                    className="relative flex h-12 flex-col items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-semibold hover:border-accent"
                  >
                    d{f}
                    {(pool[f] ?? 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-accent px-1.5 text-[11px] text-accent-fg">
                        {pool[f]}
                      </span>
                    )}
                  </button>
                ))}
                <div className="flex items-center justify-between rounded-md border border-border px-1">
                  <IconButton
                    label="Decrease modifier"
                    size="icon-sm"
                    icon={<Minus className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setModifier((m) => m - 1);
                    }}
                  />
                  <span className="text-sm font-semibold" aria-label="Modifier">
                    {modifier >= 0 ? `+${String(modifier)}` : modifier}
                  </span>
                  <IconButton
                    label="Increase modifier"
                    size="icon-sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setModifier((m) => m + 1);
                    }}
                  />
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label="Roll mode"
                className="grid grid-cols-3 rounded-md border border-border bg-sunken p-0.5 text-xs"
              >
                {(['disadvantage', 'normal', 'advantage'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m);
                    }}
                    className={cn(
                      'rounded px-2 py-1 font-medium capitalize',
                      mode === m ? 'bg-surface shadow-card' : 'text-muted',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="sr-only">Dice expression</span>
                <input
                  value={custom || poolExpression(pool, modifier)}
                  onChange={(e) => {
                    setCustom(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') doRoll();
                  }}
                  aria-invalid={!valid}
                  className={cn(
                    'h-9 w-full rounded-md border bg-surface px-3 font-mono text-sm',
                    valid ? 'border-border' : 'border-accent',
                  )}
                />
              </label>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={doRoll}
                  disabled={!valid || !hasDice}
                >
                  <Dices className="h-4 w-4" aria-hidden /> Roll
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPool({});
                    setModifier(0);
                    setCustom('');
                    setMode('normal');
                  }}
                >
                  Clear
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={threeD}
                  onChange={(e) => {
                    setThreeD(e.target.checked);
                  }}
                  className="h-3.5 w-3.5 accent-[var(--boh-accent)]"
                />
                Show 3D dice
              </label>
              <p className="text-[11px] text-faint">Right-click a die to remove one.</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {log.length === 0 ? (
                <p className="p-3 text-sm text-muted">No rolls yet this session.</p>
              ) : (
                <>
                  <ol className="space-y-1">
                    {log.map((entry) => (
                      <li key={entry.id} className="rounded-md px-2 py-1.5 odd:bg-surface-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-10 text-right font-serif text-lg font-bold">
                            {entry.total}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{entry.label ?? 'Roll'}</span>
                          <ModeBadge mode={entry.mode} />
                          <OutcomeBadge entry={entry} />
                          <time className="text-[10px] text-faint">
                            {new Date(entry.at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <Breakdown text={entry.breakdown} className="block pl-12 text-muted" />
                      </li>
                    ))}
                  </ol>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={clearLog}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear log
                  </Button>
                </>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
