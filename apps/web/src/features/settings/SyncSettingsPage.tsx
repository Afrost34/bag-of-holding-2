import { Button, Panel } from '@boh/ui';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '../../app/AppLink';
import {
  explain,
  repoFor,
  useSync,
  useSyncSettings,
  type SyncSettings,
} from '../../app/sync/store';
import { usePageTitle } from '../../app/tabs/usePageTitle';

const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new';

function guessDevice(): string {
  if (typeof navigator === 'undefined') return 'PC';
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Android|iPhone|Mobile/i.test(ua)) return 'phone';
  return 'PC';
}

/** Settings › Sync: connect this device to the private data repository on GitHub. */
export function SyncSettingsPage() {
  usePageTitle('Sync');
  const settings = useSyncSettings((s) => s.settings);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <p className="text-sm">
        <AppLink to="/settings" className="text-link hover:underline">
          Settings
        </AppLink>
      </p>
      <h1 className="font-serif text-2xl font-bold">Sync</h1>
      <p className="text-muted">
        Keeps your campaigns, journals, bookmarks, notes and homebrew the same on every device,
        through your private repository on GitHub. Each device syncs every few minutes and when you
        come back to the app; the repository keeps every version.
      </p>
      {settings ? <Connected settings={settings} /> : <Connect />}
    </div>
  );
}

function Connected({ settings }: { settings: SyncSettings }) {
  const { status, lastSync, lastResult, error, progress, syncNow } = useSync();
  const setSettings = useSyncSettings((s) => s.setSettings);
  return (
    <Panel title="This device">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Repository</dt>
        <dd>
          {settings.repository} <span className="text-faint">({settings.branch})</span>
        </dd>
        <dt className="text-muted">This device is</dt>
        <dd>{settings.device}</dd>
        <dt className="text-muted">Status</dt>
        <dd role="status">
          {status === 'syncing'
            ? progress && progress.total > 0
              ? `Syncing… ${String(progress.done)} of ${String(progress.total)} files`
              : 'Syncing…'
            : status === 'offline'
              ? 'Offline: it will sync when the connection is back.'
              : status === 'error'
                ? error
                : lastSync
                  ? `Synced at ${new Date(lastSync).toLocaleTimeString()}`
                  : 'Not synced yet'}
        </dd>
        {lastResult && status !== 'syncing' && (
          <>
            <dt className="text-muted">Last time</dt>
            <dd>
              {summary(lastResult)}
              {lastResult.conflicts.length > 0 && (
                <span className="block text-muted">
                  {lastResult.conflicts.length} file(s) were changed on two devices: the newer edit
                  was kept, the other one is in the repository&rsquo;s history.
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={status === 'syncing'} onClick={() => void syncNow()}>
          Sync now
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSettings(null);
          }}
        >
          Stop syncing this device
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Stopping keeps everything on this device and in the repository; it only forgets the token.
      </p>
    </Panel>
  );
}

function summary(r: {
  downloaded: string[];
  uploaded: string[];
  deletedHere: string[];
  deletedThere: string[];
}) {
  const parts = [
    r.downloaded.length ? `${String(r.downloaded.length)} received` : '',
    r.uploaded.length ? `${String(r.uploaded.length)} sent` : '',
    r.deletedHere.length + r.deletedThere.length
      ? `${String(r.deletedHere.length + r.deletedThere.length)} deleted`
      : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.` : 'Everything was already the same.';
}

function Connect() {
  const setSettings = useSyncSettings((s) => s.setSettings);
  const [repository, setRepository] = useState('');
  const [token, setToken] = useState('');
  const [device, setDevice] = useState(guessDevice);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const connect = async () => {
    const repo = repository
      .trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      setProblem('Write the repository as your-name/repository-name.');
      return;
    }
    setChecking(true);
    setProblem(null);
    try {
      const draft: SyncSettings = {
        repository: repo,
        branch: 'main',
        token: token.trim(),
        device: device.trim() || guessDevice(),
      };
      const info = await repoFor(draft).check();
      if (!info.private) {
        setProblem(
          'This repository is public: everyone could read your notes. Make it private on GitHub first.',
        );
      } else if (!info.canWrite) {
        setProblem(
          'The token can read but not change this repository. Give it "Contents: Read and write".',
        );
      } else {
        setSettings({ ...draft, branch: info.defaultBranch });
      }
    } catch (error) {
      setProblem(explain(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Panel title="1. Make a token on GitHub">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Open{' '}
            <a
              href={TOKEN_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-link hover:underline"
            >
              GitHub › Fine-grained tokens › Generate new token
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>{' '}
            (sign in if asked).
          </li>
          <li>
            Name it e.g. &ldquo;Bag of Holding&rdquo;, and pick an expiration (one year is fine).
          </li>
          <li>
            Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick your
            data repository (bag-of-holding-2-data).
          </li>
          <li>
            Under <b>Permissions › Repository permissions</b>, set <b>Contents</b> to{' '}
            <b>Read and write</b>. Leave everything else as it is.
          </li>
          <li>
            Press <b>Generate token</b> and copy it (it starts with <code>github_pat_</code>). Do it
            once per device, or reuse the same token on each.
          </li>
        </ol>
      </Panel>
      <Panel title="2. Connect this device">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Repository</span>
            <input
              value={repository}
              onChange={(e) => {
                setRepository(e.target.value);
              }}
              placeholder="your-name/bag-of-holding-2-data"
              autoComplete="off"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
              }}
              placeholder="github_pat_…"
              autoComplete="off"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              Kept on this device only, never synced or sent anywhere but GitHub.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name of this device</span>
            <input
              value={device}
              onChange={(e) => {
                setDevice(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
            />
          </label>
          {problem && (
            <p role="alert" className="rounded-md bg-sunken px-3 py-2 text-sm">
              {problem}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={checking || !repository.trim() || !token.trim()}
          >
            {checking ? 'Checking…' : 'Connect and sync'}
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            The first sync sends what is on this device and brings what is in the repository. When
            both have the same file, the newer version is kept and the other stays in the history.
          </p>
        </form>
      </Panel>
    </>
  );
}
