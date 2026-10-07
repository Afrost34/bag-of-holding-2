import { Button, cn } from '@boh/ui';
import { Castle, Check, Plus, Settings2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import { BUILT_IN_TEMPLATES, EDITION_LABELS } from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

/** Your campaigns: switch between them, create one from a template, open its settings. */
export function CampaignsPage() {
  const { campaigns, activeId, loaded, load, activate } = useCampaigns();
  const [creating, setCreating] = useState(false);
  usePageTitle('Campaigns');
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-wrap items-end gap-3 border-b-2 border-accent pb-2">
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Campaigns</h1>
          <span className="flex-1" />
          {campaigns.length > 0 && !creating && (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> New campaign
            </Button>
          )}
        </header>

        {!loaded && <p className="text-muted">Loading…</p>}

        {loaded && (creating || campaigns.length === 0) && (
          <NewCampaign
            first={campaigns.length === 0}
            onDone={() => {
              setCreating(false);
            }}
          />
        )}

        {campaigns.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Your campaigns">
            {campaigns.map((c) => {
              const active = c.id === activeId;
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex flex-col rounded-lg border bg-surface p-4',
                    active ? 'border-accent' : 'border-border',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Castle className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-serif text-xl font-bold">{c.name}</h2>
                      <p className="text-sm text-muted">{EDITION_LABELS[c.edition]}</p>
                    </div>
                    {active && (
                      <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {!active && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void activate(c.id)}
                        aria-label={`Open ${c.name}`}
                      >
                        <Check className="h-4 w-4" aria-hidden /> Open
                      </Button>
                    )}
                    <AppLink
                      to={`/campaigns/${encodeURIComponent(c.id)}`}
                      aria-label={`Settings of ${c.name}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-surface-2"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden /> Settings
                    </AppLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Name and template for a new campaign; the new campaign is opened at once. */
function NewCampaign({ first, onDone }: { first: boolean; onDone: () => void }) {
  const { templates, create } = useCampaigns();
  const navigate = useAppNavigate();
  const nameId = useId();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(BUILT_IN_TEMPLATES[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const all = [...BUILT_IN_TEMPLATES, ...templates];

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await create(name, templateId);
    setBusy(false);
    onDone();
    if (first) navigate('/compendium');
  };

  return (
    <section
      aria-label="New campaign"
      className="rounded-lg border border-border bg-surface-2 p-4 sm:p-5"
    >
      <h2 className="font-serif text-xl font-bold">
        {first ? 'Create your first campaign' : 'New campaign'}
      </h2>
      {first && (
        <p className="mt-1 text-sm text-muted">
          A campaign keeps its own sources, rules, notes and bookmarks (and later its vault,
          characters, boards and maps). Your current source choices, bookmarks and notes move into
          it.
        </p>
      )}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label
            htmlFor={nameId}
            className="mb-1 block text-[11px] font-semibold tracking-wider uppercase"
          >
            Campaign name
          </label>
          <input
            id={nameId}
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Rust & Sunfire"
            className="h-10 w-full max-w-md rounded-md border border-border bg-surface px-3"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-[11px] font-semibold tracking-wider uppercase">
            Start from
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {all.map((t) => (
              <label
                key={t.id}
                className={cn(
                  'flex cursor-pointer flex-col rounded-md border bg-surface p-3',
                  templateId === t.id ? 'border-accent ring-1 ring-accent' : 'border-border',
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={templateId === t.id}
                    onChange={() => {
                      setTemplateId(t.id);
                    }}
                    className="accent-accent"
                  />
                  {t.name}
                </span>
                <span className="mt-1 text-xs text-muted">{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
            Create campaign
          </Button>
          {!first && (
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
