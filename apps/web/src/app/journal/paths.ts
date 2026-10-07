/** Route of a note in the journal, e.g. `Places/Waterdeep.md`. */
export function journalPath(note: string): string {
  return `/journal?note=${encodeURIComponent(note)}`;
}
