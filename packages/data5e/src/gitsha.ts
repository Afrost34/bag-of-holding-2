/**
 * Git blob SHA-1 of file contents: `sha1("blob <size>\0" + bytes)`. Matches the SHAs in GitHub's
 * tree API, so files imported from a local folder and files downloaded from GitHub compare equal.
 */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${String(bytes.byteLength)}\0`);
  const buffer = new Uint8Array(header.byteLength + bytes.byteLength);
  buffer.set(header, 0);
  buffer.set(bytes, header.byteLength);
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
