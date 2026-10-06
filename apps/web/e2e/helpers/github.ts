import { createHash } from 'node:crypto';
import { fixtureFiles } from '@boh/data5e/testing';
import type { Page } from '@playwright/test';

/** Serves the fixture dataset in place of GitHub so e2e tests never touch the network. */

const REPO = '5etools-mirror-3/5etools-src';
export const TAG = 'v9.9.9';

function serialise(content: unknown): Buffer {
  return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
}

export async function mockGitHub(page: Page) {
  const files = fixtureFiles();
  const tree = Object.entries(files).map(([path, content]) => {
    const body = serialise(content);
    const sha = createHash('sha1')
      .update(Buffer.concat([Buffer.from(`blob ${String(body.length)}\0`), body]))
      .digest('hex');
    return { path, type: 'blob', sha, size: body.length };
  });
  const json = (body: unknown) => ({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

  await page
    .context()
    .route(`https://api.github.com/repos/${REPO}/releases/latest`, (route) =>
      route.fulfill(json({ tag_name: TAG })),
    );
  await page
    .context()
    .route(`https://api.github.com/repos/${REPO}/git/trees/**`, (route) =>
      route.fulfill(json({ tree, truncated: false })),
    );
  await page.context().route(`https://raw.githubusercontent.com/${REPO}/${TAG}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.split(`/${TAG}/`)[1] ?? '';
    const content = files[path];
    return content === undefined
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          body: serialise(content),
        });
  });
}
