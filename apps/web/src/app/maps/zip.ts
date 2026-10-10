import { inflateSync } from 'fflate';

/**
 * A zip read in place: the central directory (names and where each file is) is read from the end
 * of the file, and one entry is cut out and inflated when it is needed. Nothing else of a
 * multi-gigabyte pack is read, so a pack of 150,000 pictures is indexed in a moment. Handles zip64
 * (more than 65,535 entries, files over 4 GB).
 */

export interface ZipEntry {
  name: string;
  /** Where the entry's local header starts. */
  offset: number;
  compressed: number;
  size: number;
  /** 0 stored, 8 deflated. */
  method: number;
}

const EOCD = 0x06054b50;
const EOCD64 = 0x06064b50;
const LOCATOR64 = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const decoder = new TextDecoder();

async function bytesOf(blob: Blob, start: number, end: number): Promise<DataView> {
  const buffer = await blob.slice(start, end).arrayBuffer();
  return new DataView(buffer);
}

/** Every file in the zip (folders left out). */
export async function readZipIndex(blob: Blob): Promise<ZipEntry[]> {
  // The end-of-central-directory record is in the last 64 KB + 22 bytes (a comment may follow it).
  const tailStart = Math.max(0, blob.size - 65557);
  const tail = await bytesOf(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (tail.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('This is not a zip file.');
  let total = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  const needs64 = total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff;
  if (needs64) {
    if (eocd < 20 || tail.getUint32(eocd - 20, true) !== LOCATOR64)
      throw new Error('This zip file is damaged (no zip64 record).');
    const at = Number(tail.getBigUint64(eocd - 20 + 8, true));
    const record = await bytesOf(blob, at, at + 56);
    if (record.getUint32(0, true) !== EOCD64) throw new Error('This zip file is damaged.');
    total = Number(record.getBigUint64(32, true));
    cdSize = Number(record.getBigUint64(40, true));
    cdOffset = Number(record.getBigUint64(48, true));
  }
  const cd = await bytesOf(blob, cdOffset, cdOffset + cdSize);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < total && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== CENTRAL) throw new Error('This zip file is damaged.');
    const method = cd.getUint16(p + 10, true);
    let compressed = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLength = cd.getUint16(p + 28, true);
    const extraLength = cd.getUint16(p + 30, true);
    const commentLength = cd.getUint16(p + 32, true);
    let offset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, p + 46, nameLength));
    // zip64 extra field: the values that did not fit, in this order.
    let x = p + 46 + nameLength;
    const extraEnd = x + extraLength;
    while (x + 4 <= extraEnd) {
      const id = cd.getUint16(x, true);
      const length = cd.getUint16(x + 2, true);
      if (id === 0x0001) {
        let y = x + 4;
        if (size === 0xffffffff) {
          size = Number(cd.getBigUint64(y, true));
          y += 8;
        }
        if (compressed === 0xffffffff) {
          compressed = Number(cd.getBigUint64(y, true));
          y += 8;
        }
        if (offset === 0xffffffff) offset = Number(cd.getBigUint64(y, true));
      }
      x += 4 + length;
    }
    if (!name.endsWith('/')) entries.push({ name, offset, compressed, size, method });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The bytes of one entry, inflated. */
export async function readZipEntry(blob: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const header = await bytesOf(blob, entry.offset, entry.offset + 30);
  if (header.getUint32(0, true) !== LOCAL) throw new Error('This zip file is damaged.');
  const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const data = new Uint8Array(await blob.slice(start, start + entry.compressed).arrayBuffer());
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateSync(data, { out: new Uint8Array(entry.size) });
  throw new Error(`Unsupported compression (${String(entry.method)}) in ${entry.name}.`);
}
