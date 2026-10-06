import { Button } from '@boh/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, type ReactNode } from 'react';
import { useDice } from './store';

const VARIABLE_LABELS: Record<string, string> = {
  pb: 'Proficiency bonus',
  summonspelllevel: 'Spell slot level',
};

/** Asks for the values a roll needs: a spell slot level, a prompt, a variable like PB. */
export function RollInputDialog() {
  const { pending, submitPending, cancelPending } = useDice();
  const [values, setValues] = useState<Record<string, string>>({});

  if (!pending) return null;
  const { needs, spec } = pending;

  if (needs.scale) {
    const levels = Array.from(
      { length: needs.scale.maxLevel - needs.scale.minLevel + 1 },
      (_, i) => (needs.scale?.minLevel ?? 1) + i,
    );
    return (
      <Shell title="Cast at which level?" description={spec.label} onClose={cancelPending}>
        <div className="grid grid-cols-5 gap-2">
          {levels.map((level) => (
            <Button key={level} onClick={() => void submitPending({ level })}>
              {level}
            </Button>
          ))}
        </div>
      </Shell>
    );
  }

  const fields = [
    ...needs.variables.map((name) => ({
      id: `v:${name}`,
      label: VARIABLE_LABELS[name.toLowerCase()] ?? name,
      min: undefined,
      max: undefined,
    })),
    ...needs.prompts.map((p) => ({ id: `p:${p.title}`, label: p.title, min: p.min, max: p.max })),
  ];
  const submit = () => {
    const variables: Record<string, number> = {};
    const prompts: Record<string, number> = {};
    for (const f of fields) {
      const n = Number(values[f.id] ?? '');
      if (!Number.isFinite(n) || (values[f.id] ?? '') === '') return;
      if (f.id.startsWith('v:')) variables[f.id.slice(2)] = n;
      else prompts[f.id.slice(2)] = n;
    }
    setValues({});
    void submitPending({ variables, prompts });
  };

  return (
    <Shell
      title="This roll needs a value"
      description={spec.label ?? spec.expression}
      onClose={cancelPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {fields.map((f, i) => (
          <label key={f.id} className="block text-sm">
            <span className="mb-1 block font-medium">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              autoFocus={i === 0}
              min={f.min}
              max={f.max}
              value={values[f.id] ?? ''}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.id]: e.target.value }));
              }}
              className="h-9 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={cancelPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Roll
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Dialog.Title className="font-serif text-lg font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mb-3 text-sm text-muted">
            {description ?? ''}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
