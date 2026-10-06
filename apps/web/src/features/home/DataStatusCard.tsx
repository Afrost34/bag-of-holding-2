import { Panel } from '@boh/ui';
import { CheckCircle2, Database, Download } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '../../app/AppLink';
import { BusyNotice } from '../../app/data/BusyNotice';
import { useData } from '../../app/data/store';
import { formatNumber } from '../../app/format';

const linkClass =
  'inline-flex items-center gap-1.5 self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover sm:self-center';

export function DataStatusCard() {
  const { status, busy, progress, refresh } = useData();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status?.storage === 'busy') {
    return (
      <Panel title="5etools data">
        <BusyNotice />
      </Panel>
    );
  }

  if (status?.installed && !busy) {
    return (
      <Panel title="5etools data">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-dex" aria-hidden />
          <p className="flex-1">
            <span className="font-medium">{formatNumber(status.entities)} entries ready</span>
            <span className="block text-sm text-muted">
              Version {status.version}, stored on this device.
            </span>
          </p>
          <AppLink to="/settings/data" className="text-sm font-medium text-link hover:underline">
            Sources & updates
          </AppLink>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="5etools data">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Database className="h-8 w-8 shrink-0 text-faint" aria-hidden />
        <div className="flex-1">
          <p className="font-medium">
            {busy
              ? 'Downloading…'
              : status?.interrupted
                ? 'Download interrupted'
                : 'Not downloaded yet'}
          </p>
          <p className="text-sm text-muted">
            {busy && progress && progress.filesTotal > 0
              ? `${String(progress.filesDone)} of ${String(progress.filesTotal)} files`
              : 'The compendium needs the 5etools data (about 115 MB). It is stored on this device only.'}
          </p>
        </div>
        <AppLink to="/settings/data" className={linkClass}>
          <Download className="h-4 w-4" aria-hidden /> {busy ? 'View progress' : 'Get the data'}
        </AppLink>
      </div>
    </Panel>
  );
}
