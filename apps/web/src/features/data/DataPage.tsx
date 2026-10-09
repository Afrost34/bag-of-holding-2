import { Button, Panel } from '@boh/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '../../app/AppLink';
import { useHomebrew } from '../../app/data/homebrew';
import { useSourceList } from '../../app/data/sourceList';
import { useData } from '../../app/data/store';
import { DataSearchPanel } from './DataSearchPanel';
import { DataStatusPanel } from './DataStatusPanel';
import { HomebrewPanel } from './HomebrewPanel';
import { SourcesPanel } from '../../app/data/SourcesPanel';
import { askConfirm } from '../../app/confirm';

export function DataPage() {
  const { status, busy, clear, refresh } = useData();
  const loadSources = useSourceList((s) => s.load);
  const loadHomebrew = useHomebrew((s) => s.load);
  const installed = status?.installed === true;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Source list and homebrew follow every install/update.
  useEffect(() => {
    if (!busy && status) void loadHomebrew().then(loadSources);
  }, [busy, status, loadSources, loadHomebrew]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div>
        <AppLink
          to="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Settings
        </AppLink>
        <h1 className="mt-1 font-serif text-2xl font-bold">Data & sources</h1>
      </div>

      <DataStatusPanel />
      {installed && <SourcesPanel />}
      <HomebrewPanel />
      {installed && <DataSearchPanel />}

      {installed && !busy && (
        <Panel title="Maintenance">
          <p className="mb-3 text-sm text-muted">
            Deleting the downloaded data frees space on this device. Your campaigns, characters and
            homebrew are not affected; download again any time.
          </p>
          <Button
            onClick={() => {
              void askConfirm({
                title: 'Delete the downloaded 5etools data from this device?',
                confirmLabel: 'Delete',
              }).then((ok) => {
                if (ok) void clear();
              });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete downloaded data
          </Button>
        </Panel>
      )}
    </div>
  );
}
