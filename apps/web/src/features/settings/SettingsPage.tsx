import { cn, Panel } from '@boh/ui';
import { OpfsFileStore } from '@boh/storage';
import { ChevronRight, Database, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { AppLink } from '../../app/AppLink';
import { currentPlatform } from '../../app/platform';
import { useDiceSettings } from '../../app/dice/store';
import { useTheme, type ThemeMode } from '../../app/theme';

const themeOptions: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: 'system', label: 'System', icon: Monitor },
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
];

export function SettingsPage() {
  const { mode, setMode } = useTheme();
  const platform = currentPlatform();
  const { threeD, setThreeD } = useDiceSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <h1 className="font-serif text-2xl font-bold">Settings</h1>

      <Panel title="Appearance">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Theme</legend>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="inline-flex rounded-lg border border-border bg-sunken p-1"
          >
            {themeOptions.map(({ mode: option, label, icon: Icon }) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => {
                  setMode(option);
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === option
                    ? 'bg-surface text-text shadow-card'
                    : 'text-muted hover:text-text',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel title="Dice">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={threeD}
            onChange={(e) => {
              setThreeD(e.target.checked);
            }}
            className="h-4 w-4 accent-[var(--boh-accent)]"
          />
          <span>
            <span className="block font-medium">Show 3D dice</span>
            <span className="block text-muted">
              Dice tumble across the screen before the result appears. Turn off on slower devices.
            </span>
          </span>
        </label>
      </Panel>

      <Panel title="Data">
        <AppLink
          to="/settings/data"
          className="flex items-center gap-3 rounded-md p-1 hover:bg-sunken"
        >
          <Database className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <span className="flex-1">
            <span className="block text-sm font-medium">Data & sources</span>
            <span className="block text-sm text-muted">
              Download or update 5etools data, choose sources, add homebrew.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
        </AppLink>
      </Panel>

      <Panel title="About">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Version</dt>
          <dd>{__APP_VERSION__}</dd>
          <dt className="text-muted">Running as</dt>
          <dd>{platform === 'desktop' ? 'Desktop app' : 'Web app'}</dd>
          <dt className="text-muted">Local storage</dt>
          <dd>
            {platform === 'desktop'
              ? 'Folder on disk'
              : OpfsFileStore.isSupported()
                ? 'Browser file system (available)'
                : 'Not available in this browser'}
          </dd>
        </dl>
      </Panel>
    </div>
  );
}
