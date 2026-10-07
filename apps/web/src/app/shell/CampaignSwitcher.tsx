import * as Menu from '@radix-ui/react-dropdown-menu';
import { Castle, Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { AppLink } from '../AppLink';
import { EDITION_LABELS } from '../campaigns/model';
import { useActiveCampaign, useCampaigns } from '../campaigns/store';
import { useAppNavigate } from '../navigation';

/** The campaign open on this device, with a menu to switch, create or manage campaigns. */
export function CampaignSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { campaigns, loaded, activate } = useCampaigns();
  const active = useActiveCampaign();
  const navigate = useAppNavigate();
  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  if (!loaded) return <div className="h-12" />;
  if (!active) {
    return (
      <AppLink
        to="/campaigns"
        {...(onNavigate ? { onNavigate } : {})}
        className="mx-2 flex h-12 items-center gap-2 rounded-md border border-dashed border-chrome-2 px-3 text-sm text-chrome-muted hover:text-chrome-fg"
      >
        <Plus className="h-4 w-4" aria-hidden /> Create a campaign
      </AppLink>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Campaign: ${active.name}. Switch campaign`}
        className="mx-2 flex h-12 items-center gap-2.5 rounded-md bg-chrome-2/60 px-3 text-left hover:bg-chrome-2"
      >
        <Castle className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-chrome-fg">{active.name}</span>
          <span className="block truncate text-[11px] text-chrome-muted">
            {EDITION_LABELS[active.edition]}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-chrome-muted" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-56 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
        >
          <Menu.Label className="px-2 py-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
            Campaigns
          </Menu.Label>
          {campaigns.map((c) => (
            <Menu.Item
              key={c.id}
              onSelect={() => void activate(c.id)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
            >
              <span className="w-4">
                {c.id === active.id && <Check className="h-4 w-4 text-accent-ink" aria-hidden />}
              </span>
              <span className="flex-1 truncate">{c.name}</span>
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item
            onSelect={() => {
              go(`/campaigns/${encodeURIComponent(active.id)}`);
            }}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
          >
            <Settings2 className="h-4 w-4" aria-hidden /> Settings of {active.name}
          </Menu.Item>
          <Menu.Item
            onSelect={() => {
              go('/campaigns');
            }}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
          >
            <Plus className="h-4 w-4" aria-hidden /> New or manage campaigns
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
