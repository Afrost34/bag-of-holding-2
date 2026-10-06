/** A die roller: returns an integer in 1..faces. Injectable so tests are deterministic. */
export type Rng = (faces: number) => number;

/** Unbiased rolls from the platform's cryptographic random source (rejection sampling). */
export const secureRng: Rng = (faces) => {
  if (!Number.isInteger(faces) || faces < 1) throw new RangeError(`Invalid die: d${String(faces)}`);
  const limit = Math.floor(0x1_0000_0000 / faces) * faces;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) return (value % faces) + 1;
  }
};

/** Replays fixed values in order (tests and "show the dice that landed"). */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return (faces) => {
    const value = values[i++ % values.length] ?? 1;
    return Math.min(Math.max(1, value), faces);
  };
}
