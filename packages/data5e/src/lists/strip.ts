/**
 * Plain text from 5etools rich text for list cells: `{@spell fireball|xphb|Fireball}` → `Fireball`.
 * A simplified version of the renderer's `stripTags` (the data package cannot depend on it).
 */
export function stripTagsPlain(input: string): string {
  let out = input;
  // Innermost tags first, until none remain.
  for (let i = 0; i < 10 && out.includes('{@'); i++) {
    out = out.replace(/\{@\w+\s?([^{}]*)\}/g, (_m, body: string) => {
      const parts = body.split('|');
      const display = parts[2]?.trim() ?? '';
      return display !== '' ? display : (parts[0]?.trim() ?? '');
    });
  }
  return out;
}
