import { createHash } from 'node:crypto';
import type { Page, Route } from '@playwright/test';

/**
 * The private data repository, faked: GitHub's REST "Git data" endpoints over blobs, trees and
 * commits kept in memory, so sync can be tested without the network or a token.
 */
export class FakeDataRepo {
  blobs = new Map<string, Buffer>();
  trees = new Map<string, Record<string, string>>();
  commits = new Map<string, { tree: string; parents: string[]; date: string }>();
  branch: string | null = null;
  private n = 0;

  constructor(
    readonly owner = 'me',
    readonly name = 'bag-of-holding-2-data',
  ) {}

  private id(prefix: string) {
    this.n++;
    return `${prefix}${String(this.n).padStart(39, '0')}`;
  }

  blob(content: Buffer): string {
    const sha = createHash('sha1')
      .update(Buffer.concat([Buffer.from(`blob ${String(content.length)}\0`), content]))
      .digest('hex');
    this.blobs.set(sha, content);
    return sha;
  }

  commit(tree: string, parents: string[]): string {
    const sha = this.id('c');
    this.commits.set(sha, { tree, parents, date: new Date().toISOString() });
    return sha;
  }

  /** The files at the branch: path → text. */
  files(): Record<string, string> {
    const tree = this.trees.get(this.commits.get(this.branch ?? '')?.tree ?? '') ?? {};
    return Object.fromEntries(
      Object.entries(tree).map(([p, sha]) => [p, this.blobs.get(sha)?.toString('utf8') ?? '']),
    );
  }

  /** Another device's commit: these files written (or deleted with null). */
  push(changes: Record<string, string | null>): void {
    const head = this.commits.get(this.branch ?? '');
    const files = { ...(this.trees.get(head?.tree ?? '') ?? {}) };
    for (const [path, text] of Object.entries(changes)) {
      if (text === null) Reflect.deleteProperty(files, path);
      else files[path] = this.blob(Buffer.from(text));
    }
    const tree = this.id('t');
    this.trees.set(tree, files);
    this.branch = this.commit(tree, this.branch ? [this.branch] : []);
  }

  async attach(page: Page): Promise<void> {
    const base = `https://api.github.com/repos/${this.owner}/${this.name}`;
    await page.route(`${base}**`, (route) => this.handle(route, base));
  }

  private handle(route: Route, base: string) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.href.slice(base.length).split('?')[0] ?? '';
    const method = request.method();
    const body = (): Record<string, unknown> => request.postDataJSON() as Record<string, unknown>;
    const json = (status: number, data: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(data),
      });
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET, POST, PATCH, PUT',
        },
      });
    }
    if (method === 'GET' && path === '') {
      return json(200, { default_branch: 'main', private: true, permissions: { push: true } });
    }
    if (method === 'GET' && path === '/git/ref/heads/main') {
      return this.branch
        ? json(200, { object: { sha: this.branch } })
        : json(409, { message: 'Git Repository is empty.' });
    }
    if (method === 'PUT' && path === '/contents/README.md') {
      this.push({ 'README.md': '# data\n' });
      return json(201, {});
    }
    const commitGet = /^\/git\/commits\/(\w+)$/.exec(path);
    if (method === 'GET' && commitGet) {
      const c = this.commits.get(commitGet[1] ?? '');
      return c ? json(200, { tree: { sha: c.tree } }) : json(404, { message: 'Not Found' });
    }
    const treeGet = /^\/git\/trees\/(\w+)$/.exec(path);
    if (method === 'GET' && treeGet) {
      const tree = this.trees.get(treeGet[1] ?? '') ?? {};
      return json(200, {
        truncated: false,
        tree: Object.entries(tree).map(([p, sha]) => ({ path: p, type: 'blob', sha })),
      });
    }
    const blobGet = /^\/git\/blobs\/(\w+)$/.exec(path);
    if (method === 'GET' && blobGet) {
      const b = this.blobs.get(blobGet[1] ?? '');
      return b ? json(200, { content: b.toString('base64'), encoding: 'base64' }) : json(404, {});
    }
    if (method === 'POST' && path === '/git/blobs') {
      return json(201, { sha: this.blob(Buffer.from(String(body().content), 'base64')) });
    }
    if (method === 'POST' && path === '/git/trees') {
      const b = body() as { base_tree: string; tree: { path: string; sha: string | null }[] };
      const files = { ...(this.trees.get(b.base_tree) ?? {}) };
      for (const e of b.tree) {
        if (e.sha === null) Reflect.deleteProperty(files, e.path);
        else files[e.path] = e.sha;
      }
      const sha = this.id('t');
      this.trees.set(sha, files);
      return json(201, { sha });
    }
    if (method === 'POST' && path === '/git/commits') {
      const b = body() as { tree: string; parents: string[] };
      return json(201, { sha: this.commit(b.tree, b.parents) });
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      const sha = String(body().sha);
      if (!this.commits.get(sha)?.parents.includes(this.branch ?? '')) {
        return json(422, { message: 'Update is not a fast forward' });
      }
      this.branch = sha;
      return json(200, {});
    }
    if (method === 'GET' && path === '/commits') {
      return json(200, [
        { commit: { committer: { date: this.commits.get(this.branch ?? '')?.date } } },
      ]);
    }
    return json(404, { message: `Not handled: ${method} ${path}` });
  }
}
