import { isDataFile } from './files';
import { gitBlobSha } from './gitsha';

export interface RemoteFile {
  /** Repo-relative path, e.g. `data/spells/spells-xphb.json`. */
  path: string;
  /** Git blob SHA-1, used to skip unchanged files on update. */
  sha: string;
  size: number;
}

/** Where 5etools files come from: GitHub, or a folder/zip the user picked. */
export interface DataSource {
  /** Human label, e.g. `5etools-mirror-3/5etools-src` or `Local folder`. */
  readonly label: string;
  /** Version tag, e.g. `v2.36.1`. */
  readonly version: string;
  listFiles(): Promise<RemoteFile[]>;
  readFile(path: string, signal?: AbortSignal): Promise<Uint8Array>;
}

/** The 5etools source parser; holds source names and dates. */
export const PARSER_FILE = 'js/parser.js';

export function isWantedFile(path: string): boolean {
  return path === PARSER_FILE || isDataFile(path);
}

export const DEFAULT_REPO = '5etools-mirror-3/5etools-src';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The global fetch, called as a plain function. Browsers throw "Illegal invocation" when `fetch`
 * is called as a method of another object (e.g. stored on a class and called as `this.fetchFn`).
 */
const globalFetch: Fetch = (input, init) => fetch(input, init);

async function fetchJson<T>(fetchFn: Fetch, url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchFn(url, {
    headers: { Accept: 'application/vnd.github+json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok)
    throw new Error(`GET ${url} failed: ${String(response.status)} ${response.statusText}`);
  return (await response.json()) as T;
}

/** Latest release tag of a GitHub repo, e.g. `v2.36.1`. */
export async function latestReleaseTag(
  repo: string,
  fetchFn: Fetch = globalFetch,
): Promise<string> {
  const release = await fetchJson<{ tag_name: string }>(
    fetchFn,
    `https://api.github.com/repos/${repo}/releases/latest`,
  );
  return release.tag_name;
}

/**
 * Files of a tagged 5etools release on GitHub. The file list (with SHAs) comes from one API call;
 * contents come from raw.githubusercontent.com, which is CORS-enabled and not rate limited.
 */
export class GitHubDataSource implements DataSource {
  readonly label: string;

  constructor(
    readonly repo: string,
    readonly version: string,
    private readonly fetchFn: Fetch = globalFetch,
  ) {
    this.label = repo;
  }

  async listFiles(): Promise<RemoteFile[]> {
    const tree = await fetchJson<{
      tree: { path: string; type: string; sha: string; size?: number }[];
      truncated: boolean;
    }>(
      this.fetchFn,
      `https://api.github.com/repos/${this.repo}/git/trees/${this.version}?recursive=1`,
    );
    if (tree.truncated) throw new Error('GitHub returned a truncated file list for this release.');
    return tree.tree
      .filter((e) => e.type === 'blob' && isWantedFile(e.path))
      .map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }));
  }

  async readFile(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    const url = `https://raw.githubusercontent.com/${this.repo}/${this.version}/${path}`;
    const fetchFn = this.fetchFn; // a plain call: never `this.fetchFn(...)`, see globalFetch
    const response = await fetchFn(url, signal ? { signal } : undefined);
    if (!response.ok) throw new Error(`GET ${path} failed: ${String(response.status)}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

/**
 * Files the user provided (a picked folder or an unzipped archive). Paths may carry a leading
 * folder (`5etools-src/data/...`); everything before the first `data/` or `js/` is dropped.
 */
export class LocalDataSource implements DataSource {
  readonly label = 'Local files';
  readonly version: string;
  private readonly files = new Map<string, Uint8Array>();

  constructor(files: Iterable<[string, Uint8Array]>, version?: string) {
    for (const [rawPath, bytes] of files) {
      const path = normaliseLocalPath(rawPath);
      if (path && isWantedFile(path)) this.files.set(path, bytes);
    }
    this.version = version ?? 'local';
  }

  get size(): number {
    return this.files.size;
  }

  async listFiles(): Promise<RemoteFile[]> {
    const out: RemoteFile[] = [];
    for (const [path, bytes] of this.files) {
      out.push({ path, sha: await gitBlobSha(bytes), size: bytes.byteLength });
    }
    return out;
  }

  readFile(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(path);
    return bytes ? Promise.resolve(bytes) : Promise.reject(new Error(`Missing file ${path}`));
  }
}

export function normaliseLocalPath(path: string): string | null {
  const posix = path.replaceAll('\\', '/');
  const match = /(?:^|\/)((?:data|js)\/.+)$/.exec(posix);
  return match?.[1] ?? null;
}

/** Reads the `version` field of a 5etools package.json, prefixed with `v`. */
export function versionFromPackageJson(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return undefined;
  try {
    const pkg = JSON.parse(new TextDecoder().decode(bytes)) as { version?: unknown };
    return typeof pkg.version === 'string' ? `v${pkg.version}` : undefined;
  } catch {
    return undefined;
  }
}
