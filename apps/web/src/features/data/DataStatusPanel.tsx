import { Button, cn, Panel } from '@boh/ui';
import { AlertTriangle, CheckCircle2, Download, FolderOpen, RefreshCw, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { BusyNotice } from '../../app/data/BusyNotice';
import type { LocalFile } from '../../app/data/protocol';
import { useData } from '../../app/data/store';
import { formatBytes, formatDate, formatDuration, formatNumber } from '../../app/format';

const PHASE_LABEL = {
  listing: 'Getting the file list…',
  downloading: 'Downloading and indexing',
  linking: 'Linking entries…',
  done: 'Finishing…',
} as const;

export function DataStatusPanel() {
  const { status, busy, error, update, lastInstall } = useData();
  const { installLatest, checkForUpdate, cancel, installFromFiles } = useData();
  const [checking, setChecking] = useState(false);

  const onCheck = async () => {
    setChecking(true);
    await checkForUpdate();
    setChecking(false);
  };

  return (
    <Panel title="5etools data">
      <div className="space-y-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-accent-soft p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        {status?.storage === 'busy' ? (
          <BusyNotice />
        ) : busy ? (
          <InstallProgressView />
        ) : !status ? (
          <p className="text-sm text-muted">Opening the local index…</p>
        ) : status.installed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-dex" aria-hidden />
            <div className="flex-1">
              <p className="font-medium">
                Version {status.version} · {formatNumber(status.entities)} entries
              </p>
              <p className="text-sm text-muted">
                {status.installedAt ? `Updated ${formatDate(status.installedAt)}` : null}
                {status.origin ? ` from ${status.origin}` : null}
              </p>
            </div>
            {update && !update.updateAvailable ? (
              <span className="text-sm text-muted">Up to date</span>
            ) : update?.updateAvailable ? (
              <Button variant="primary" onClick={() => void installLatest()}>
                <Download className="h-4 w-4" aria-hidden /> Update to {update.latest}
              </Button>
            ) : (
              <Button onClick={() => void onCheck()} disabled={checking}>
                <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} aria-hidden />
                Check for updates
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {status.interrupted
                ? `The download of ${status.interrupted} was interrupted. Resume it to finish; finished files are kept.`
                : 'Bag of Holding needs the 5etools data: about 115 MB, downloaded once and kept on this device. Nothing is uploaded.'}
            </p>
            <Button variant="primary" onClick={() => void installLatest()}>
              <Download className="h-4 w-4" aria-hidden />
              {status.interrupted ? 'Resume download' : 'Download 5etools data'}
            </Button>
          </div>
        )}

        {lastInstall && !busy && (
          <div className="rounded-md bg-sunken p-3 text-sm">
            <p>
              {lastInstall.added + lastInstall.changed + lastInstall.removed === 0
                ? `Already up to date with ${lastInstall.version}.`
                : `Installed ${lastInstall.version}: ${String(lastInstall.added)} new, ${String(lastInstall.changed)} changed, ${String(lastInstall.removed)} removed files in ${formatDuration(lastInstall.durationMs)}.`}
            </p>
            {lastInstall.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted">
                  {lastInstall.warnings.length} warning(s)
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {lastInstall.warnings.slice(0, 50).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {status?.storage === 'memory' && (
          <p className="text-sm text-muted">
            This browser can&apos;t store the index permanently, so it will be rebuilt each time the
            app opens. A recent Chrome, Edge, Firefox or Safari avoids this.
          </p>
        )}

        {!busy && status?.storage !== 'busy' && (
          <LocalImport
            onFiles={(files) => void installFromFiles(files)}
            label={
              status?.installed
                ? 'Import from a folder or .zip instead'
                : 'Or import a downloaded copy (folder or .zip)'
            }
          />
        )}

        {busy && (
          <Button variant="ghost" size="sm" onClick={cancel}>
            <X className="h-4 w-4" aria-hidden /> Cancel
          </Button>
        )}
      </div>
    </Panel>
  );
}

function InstallProgressView() {
  const progress = useData((s) => s.progress);
  const fraction =
    progress && progress.bytesTotal > 0 ? progress.bytesDone / progress.bytesTotal : null;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{progress ? PHASE_LABEL[progress.phase] : 'Starting…'}</span>
        {progress && progress.filesTotal > 0 && (
          <span className="text-muted">
            {progress.filesDone} / {progress.filesTotal} files · {formatBytes(progress.bytesDone)}{' '}
            of {formatBytes(progress.bytesTotal)}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Install progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
        className="h-2 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className={cn(
            'h-full rounded-full bg-accent transition-[width]',
            fraction === null && 'w-1/3 animate-pulse',
          )}
          style={
            fraction === null ? undefined : { width: `${String(Math.max(2, fraction * 100))}%` }
          }
        />
      </div>
      {progress?.currentFile && (
        <p className="truncate text-xs text-faint">{progress.currentFile}</p>
      )}
    </div>
  );
}

function LocalImport({ onFiles, label }: { onFiles: (files: LocalFile[]) => void; label: string }) {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    const files: LocalFile[] = [...list].map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    event.target.value = '';
    onFiles(files);
  };

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted hover:text-text">{label}</summary>
      <p className="mt-2 text-muted">
        Use this if GitHub is unreachable, or to install a specific 5etools version. Pick the
        5etools folder (the one containing <code>data</code>), or its release .zip.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => folderRef.current?.click()}>
          <FolderOpen className="h-4 w-4" aria-hidden /> Choose folder
        </Button>
        <Button size="sm" onClick={() => zipRef.current?.click()}>
          <FolderOpen className="h-4 w-4" aria-hidden /> Choose .zip
        </Button>
      </div>
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        onChange={handle}
        {...{ webkitdirectory: '', directory: '' }}
        multiple
      />
      <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={handle} />
    </details>
  );
}
