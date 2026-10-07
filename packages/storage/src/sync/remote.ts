/**
 * A Git repository as the sync sees it: a branch pointing at commits whose trees hold blobs.
 * `GitHubRepo` talks to GitHub; tests use an in-memory one.
 */

export interface RemoteHead {
  commit: string;
  tree: string;
}

export interface RemoteRepo {
  /** The branch's latest commit, or null when the repository is still empty. */
  head(): Promise<RemoteHead | null>;
  /** Gives an empty repository its first commit (a README), so it has a branch. */
  init(): Promise<void>;
  /** Every file in a tree: path → blob hash. */
  tree(sha: string): Promise<Record<string, string>>;
  readBlob(sha: string): Promise<Uint8Array>;
  /** Stores file content, returning its blob hash. */
  writeBlob(bytes: Uint8Array): Promise<string>;
  /** A tree made from `base` with these files changed (`sha: null` deletes a file). */
  writeTree(base: string, changes: { path: string; sha: string | null }[]): Promise<string>;
  writeCommit(message: string, tree: string, parents: string[]): Promise<string>;
  /** Moves the branch to `commit`; false when it no longer points at `expected` (another device). */
  moveBranch(commit: string, expected: string): Promise<boolean>;
  /** When a file last changed in the repository (ms since 1970), or null. */
  lastChange(path: string): Promise<number | null>;
}

/** Git's hash of file content (`git hash-object`), the same on every device and on GitHub. */
export async function blobSha(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${String(bytes.length)}\0`);
  const all = new Uint8Array(header.length + bytes.length);
  all.set(header);
  all.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubRepoOptions {
  owner: string;
  repo: string;
  branch: string;
  /** A fine-grained token with read and write access to the repository's contents. */
  token: string;
  fetch?: typeof fetch;
}

/**
 * A repository on GitHub through its REST API (which browsers may call, unlike Git's own HTTP
 * protocol). Only the low-level "Git data" calls are used, so every sync is one commit.
 */
export class GitHubRepo implements RemoteRepo {
  private readonly base: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: GitHubRepoOptions) {
    this.base = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;
    this.fetcher = options.fetch ?? fetch.bind(globalThis);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetcher(`${this.base}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.options.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    if (!response.ok) {
      let message = response.statusText;
      try {
        const data = (await response.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // Keep the status text.
      }
      throw new GitHubError(response.status, message);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  /** Checks the repository exists and the token may write to it. */
  async check(): Promise<{ defaultBranch: string; canWrite: boolean; private: boolean }> {
    const repo = await this.call<{
      default_branch: string;
      private: boolean;
      permissions?: { push?: boolean };
    }>('GET', '');
    return {
      defaultBranch: repo.default_branch,
      canWrite: repo.permissions?.push === true,
      private: repo.private,
    };
  }

  async head(): Promise<RemoteHead | null> {
    let ref: { object: { sha: string } };
    try {
      ref = await this.call('GET', `/git/ref/heads/${encodeURIComponent(this.options.branch)}`);
    } catch (error) {
      // An empty repository answers 409; a missing branch 404.
      if (error instanceof GitHubError && (error.status === 409 || error.status === 404))
        return null;
      throw error;
    }
    const commit = await this.call<{ tree: { sha: string } }>(
      'GET',
      `/git/commits/${ref.object.sha}`,
    );
    return { commit: ref.object.sha, tree: commit.tree.sha };
  }

  async init(): Promise<void> {
    await this.call('PUT', '/contents/README.md', {
      message: 'Start the Bag of Holding data repository',
      content: toBase64(
        new TextEncoder().encode(
          '# Bag of Holding data\n\nYour campaigns, journals and settings, kept by the app.\n',
        ),
      ),
      branch: this.options.branch,
    });
  }

  async tree(sha: string): Promise<Record<string, string>> {
    const data = await this.call<{
      tree: { path: string; type: string; sha: string }[];
      truncated: boolean;
    }>('GET', `/git/trees/${sha}?recursive=1`);
    if (data.truncated) throw new Error('The repository has too many files to sync');
    return Object.fromEntries(
      data.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]),
    );
  }

  async readBlob(sha: string): Promise<Uint8Array> {
    const data = await this.call<{ content: string; encoding: string }>('GET', `/git/blobs/${sha}`);
    return data.encoding === 'base64'
      ? fromBase64(data.content)
      : new TextEncoder().encode(data.content);
  }

  async writeBlob(bytes: Uint8Array): Promise<string> {
    const data = await this.call<{ sha: string }>('POST', '/git/blobs', {
      content: toBase64(bytes),
      encoding: 'base64',
    });
    return data.sha;
  }

  async writeTree(base: string, changes: { path: string; sha: string | null }[]): Promise<string> {
    const data = await this.call<{ sha: string }>('POST', '/git/trees', {
      base_tree: base,
      tree: changes.map((c) => ({ path: c.path, mode: '100644', type: 'blob', sha: c.sha })),
    });
    return data.sha;
  }

  async writeCommit(message: string, tree: string, parents: string[]): Promise<string> {
    const data = await this.call<{ sha: string }>('POST', '/git/commits', {
      message,
      tree,
      parents,
    });
    return data.sha;
  }

  async moveBranch(commit: string, expected: string): Promise<boolean> {
    const current = await this.head();
    if (current?.commit !== expected) return false;
    try {
      await this.call('PATCH', `/git/refs/heads/${encodeURIComponent(this.options.branch)}`, {
        sha: commit,
        force: false,
      });
      return true;
    } catch (error) {
      // Not a fast-forward: another device pushed in between.
      if (error instanceof GitHubError && error.status === 422) return false;
      throw error;
    }
  }

  async lastChange(path: string): Promise<number | null> {
    const commits = await this.call<{ commit: { committer: { date: string } } }[]>(
      'GET',
      `/commits?sha=${encodeURIComponent(this.options.branch)}&path=${encodeURIComponent(path)}&per_page=1`,
    );
    const date = commits[0]?.commit.committer.date;
    return date ? Date.parse(date) : null;
  }
}
