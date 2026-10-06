const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === 'string' ? encoder.encode(data) : data;
}

export function toText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function sortEntries<T extends { name: string }>(entries: T[]): T[] {
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
