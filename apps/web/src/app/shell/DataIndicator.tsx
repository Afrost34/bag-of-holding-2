import { IconButton } from '@boh/ui';
import { DatabaseZap } from 'lucide-react';
import { useEffect } from 'react';
import { useData } from '../data/store';
import { useAppNavigate } from '../navigation';

let checked = false;

/**
 * A small sign in the top bar when the 5etools data needs attention: not downloaded, a download
 * left unfinished, or a newer release out (looked for once a session, when online). Nothing
 * shows when all is well; the details are in Settings › Data.
 */
export function DataIndicator() {
  const navigate = useAppNavigate();
  const status = useData((s) => s.status);
  const update = useData((s) => s.update);
  const busy = useData((s) => s.busy);
  const refresh = useData((s) => s.refresh);
  const checkForUpdate = useData((s) => s.checkForUpdate);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (checked || !status?.installed || !navigator.onLine) return;
    checked = true;
    void checkForUpdate();
  }, [status?.installed, checkForUpdate]);

  if (!status || status.storage === 'busy') return null;
  const label = busy
    ? '5etools data: downloading'
    : !status.installed
      ? status.interrupted
        ? '5etools data: download unfinished'
        : '5etools data: not downloaded'
      : update?.updateAvailable
        ? `5etools data: version ${update.latest} is out`
        : null;
  if (!label) return null;
  return (
    <IconButton
      className="mb-1 text-accent-ink"
      variant="chrome"
      size="icon-sm"
      label={label}
      tooltipSide="bottom"
      icon={<DatabaseZap className={busy ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />}
      onClick={() => {
        navigate('/settings/data');
      }}
    />
  );
}
