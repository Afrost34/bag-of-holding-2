import { Button } from '@boh/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { shrinkImage } from '../../app/shrinkImage';

/** Form pieces shared by the homebrew editors. */

export const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-base focus:border-accent focus:outline-none sm:text-sm';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <legend className="px-1 font-serif font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-3">{children}</div>;
}

export function Text({
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

export function NumberField({
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

export function Select({
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

export function TextArea({
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
export function PictureField({
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
