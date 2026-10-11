import { useCallback, useState } from 'react';

const PREFIX = 'boh.map.';

function read<T extends object>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return initial;
    const value: unknown = JSON.parse(raw);
    // What was kept fills the settings that exist now; a setting added since keeps its default.
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...initial, ...(value as Partial<T>) }
      : initial;
  } catch {
    return initial;
  }
}

/**
 * State that is also kept on this device (a tool's settings come back as they were left, after a
 * restart too). Reading or writing can fail (a private window): the state then lasts until the
 * page closes.
 */
export function useStored<T extends object>(
  key: string,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next;
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(resolved));
        } catch {
          /* kept in memory only */
        }
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}

/** A number kept the same way. */
export function useStoredNumber(
  key: string,
  initial: number,
): [number, (n: number | ((p: number) => number)) => void] {
  const [box, setBox] = useStored<{ value: number }>(key, { value: initial });
  const set = useCallback(
    (next: number | ((previous: number) => number)) => {
      setBox((b) => ({ value: typeof next === 'function' ? next(b.value) : next }));
    },
    [setBox],
  );
  return [box.value, set];
}
