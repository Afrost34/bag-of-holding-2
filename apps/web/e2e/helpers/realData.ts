import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * The real, pinned 5etools release (`pnpm data:fetch`, gitignored) served in place of GitHub:
 * for e2e tests that need what the small fixture lacks (spells, every class feature, item
 * templates). Adventures and books are left out to keep the install quick.
 */

const REPO = '5etools-mirror-3/5etools-src';
const TAG = 'v9.9.9';
const ROOT = path.resolve(process.cwd(), '../../.data/5etools');

function releaseDir(): string | null {
  if (!fs.existsSync(ROOT)) return null;
  const versions = fs.readdirSync(ROOT).filter((d) => d.startsWith('v'));
  const latest = versions.sort().at(-1);
  return latest ? path.join(ROOT, latest) : null;
}

/** Whether the real data has been downloaded (tests that need it are skipped otherwise). */
export const hasRealData = () => releaseDir() !== null;

function walk(dir: string, rel: string): string[] {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) return /^data\/(adventure|book)$/.test(r) ? [] : walk(dir, r);
    return r.endsWith('.json') ? [r] : [];
  });
}

export async function installRealData(page: Page): Promise<void> {
  const root = releaseDir();
  if (!root) throw new Error('No 5etools data: run pnpm data:fetch');
  const tree = walk(root, 'data').map((p) => {
    const body = fs.readFileSync(path.join(root, p));
    const sha = createHash('sha1')
      .update(Buffer.concat([Buffer.from(`blob ${String(body.length)}\0`), body]))
      .digest('hex');
    return { path: p, type: 'blob', sha, size: body.length };
  });
  const json = (body: unknown) => ({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
  const context = page.context();
  await context.route(`https://api.github.com/repos/${REPO}/releases/latest`, (r) =>
    r.fulfill(json({ tag_name: TAG })),
  );
  await context.route(`https://api.github.com/repos/${REPO}/git/trees/**`, (r) =>
    r.fulfill(json({ tree, truncated: false })),
  );
  await context.route(`https://raw.githubusercontent.com/${REPO}/${TAG}/**`, (r) => {
    const p = new URL(r.request().url()).pathname.split(`/${TAG}/`)[1] ?? '';
    const file = path.join(root, decodeURIComponent(p));
    return fs.existsSync(file)
      ? r.fulfill({ headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(file) })
      : r.fulfill({ status: 404 });
  });
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: 'Download 5etools data' }).click();
  await expect(page.getByText(/entries$/)).toBeVisible({ timeout: 240_000 });
}

/** Writes a character file straight into the user's data, as the app stores it. */
export async function putCharacter(
  page: Page,
  character: { id: string; name: string } & Record<string, unknown>,
): Promise<void> {
  const file = {
    version: 1,
    createdAt: '',
    updatedAt: '',
    summary: '',
    abilityMethod: 'manual',
    details: {},
    coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    companions: [],
    preferences: { multiclassRequirements: true, feats: true, abilityDisplay: 'modifiers' },
    ...character,
  };
  await page.evaluate(async (text) => {
    const parsed = JSON.parse(text) as { id: string };
    const root = await navigator.storage.getDirectory();
    const dir = await (
      await root.getDirectoryHandle('user-data', { create: true })
    ).getDirectoryHandle('characters', { create: true });
    const w = await (
      await dir.getFileHandle(`${parsed.id}.json`, { create: true })
    ).createWritable();
    await w.write(text);
    await w.close();
  }, JSON.stringify(file));
}
