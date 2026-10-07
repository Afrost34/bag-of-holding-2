import { Button, cn, Panel } from '@boh/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import {
  EDITION_LABELS,
  type Campaign,
  type CampaignEdition,
  type CampaignRules,
} from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { SourcesPanel } from '../../app/data/SourcesPanel';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';

const EDITIONS: { id: CampaignEdition; hint: string }[] = [
  { id: '2024', hint: 'Links without a source, the builder and encounters use 2024 versions.' },
  { id: '2014', hint: 'They use 2014 versions.' },
  { id: 'mixed', hint: 'Choose per character and encounter, with warnings where they mix.' },
];

const ENCUMBRANCE: { id: CampaignRules['encumbrance']; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'standard', label: 'Standard (carrying capacity)' },
  { id: 'variant', label: 'Variant (encumbered, heavily encumbered)' },
];

export function CampaignSettingsPage({ id }: { id: string }) {
  const { campaigns, activeId, loaded, load } = useCampaigns();
  const campaign = campaigns.find((c) => c.id === id);
  usePageTitle(campaign?.name);
  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return <p className="p-8 text-muted">Loading…</p>;
  if (!campaign) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Campaign not found</h1>
        <AppLink
          to="/campaigns"
          className="mt-4 inline-block font-medium text-link hover:underline"
        >
          All campaigns
        </AppLink>
      </div>
    );
  }
  return <Settings key={campaign.id} campaign={campaign} active={campaign.id === activeId} />;
}

function Settings({ campaign, active }: { campaign: Campaign; active: boolean }) {
  const { update, activate, remove, saveTemplate } = useCampaigns();
  const navigate = useAppNavigate();
  const nameId = useId();
  const templateNameId = useId();
  const [name, setName] = useState(campaign.name);
  const [templateName, setTemplateName] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        <header className="border-b-2 border-accent pb-2">
          <AppLink
            to="/campaigns"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Campaigns
          </AppLink>
          <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">{campaign.name}</h1>
        </header>

        {!active && (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-sunken p-3 text-sm">
            <span className="flex-1">This campaign is not open on this device.</span>
            <Button variant="primary" size="sm" onClick={() => void activate(campaign.id)}>
              Open {campaign.name}
            </Button>
          </div>
        )}

        <Panel title="Campaign">
          <div className="space-y-5">
            <div>
              <label
                htmlFor={nameId}
                className="mb-1 block text-[11px] font-semibold tracking-wider uppercase"
              >
                Name
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                onBlur={() => {
                  if (name.trim() && name !== campaign.name)
                    void update(campaign.id, { name: name.trim() });
                }}
                className="h-10 w-full max-w-md rounded-md border border-border bg-surface px-3"
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold tracking-wider uppercase">
                Edition
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {EDITIONS.map((e) => (
                  <label
                    key={e.id}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-md border p-3',
                      campaign.edition === e.id
                        ? 'border-accent ring-1 ring-accent'
                        : 'border-border',
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="radio"
                        name="edition"
                        checked={campaign.edition === e.id}
                        onChange={() => void update(campaign.id, { edition: e.id })}
                        className="accent-accent"
                      />
                      {EDITION_LABELS[e.id]}
                    </span>
                    <span className="mt-1 text-xs text-muted">{e.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>

        <Panel title="Rules">
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold tracking-wider uppercase">
                Encumbrance
              </legend>
              <div className="flex flex-col gap-1.5">
                {ENCUMBRANCE.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="encumbrance"
                      checked={campaign.rules.encumbrance === o.id}
                      onChange={() =>
                        void update(campaign.id, {
                          rules: { ...campaign.rules, encumbrance: o.id },
                        })
                      }
                      className="accent-accent"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={campaign.rules.optionalClassFeatures}
                onChange={(e) =>
                  void update(campaign.id, {
                    rules: { ...campaign.rules, optionalClassFeatures: e.target.checked },
                  })
                }
                className="mt-0.5 accent-accent"
              />
              <span>
                Optional class features (2014)
                <span className="block text-xs text-muted">
                  Offered by the character builder, from Tasha&apos;s Cauldron of Everything.
                </span>
              </span>
            </label>
            <p className="text-xs text-muted">
              Variant rules and playtest material are chosen through the sources below.
            </p>
          </div>
        </Panel>

        {active ? (
          <SourcesPanel />
        ) : (
          <Panel title="Sources">
            <p className="text-sm text-muted">Open this campaign to choose its sources.</p>
          </Panel>
        )}

        <Panel title="Template">
          <p className="mb-3 text-sm text-muted">
            Save this campaign&apos;s edition, sources and rules as a template for new campaigns.
          </p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!templateName.trim()) return;
              void saveTemplate(campaign.id, templateName).then(() => {
                setTemplateName('');
                setTemplateSaved(true);
              });
            }}
          >
            <div>
              <label
                htmlFor={templateNameId}
                className="mb-1 block text-[11px] font-semibold tracking-wider uppercase"
              >
                Template name
              </label>
              <input
                id={templateNameId}
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setTemplateSaved(false);
                }}
                className="h-9 w-64 rounded-md border border-border bg-surface px-3"
              />
            </div>
            <Button type="submit" disabled={!templateName.trim()}>
              Save as template
            </Button>
            {templateSaved && (
              <span role="status" className="text-sm text-muted">
                Saved.
              </span>
            )}
          </form>
        </Panel>

        <section className="rounded-lg border border-accent/40 p-4">
          <h2 className="font-semibold">Delete campaign</h2>
          <p className="mt-1 text-sm text-muted">
            Deletes its settings, notes and bookmarks from this device. Once sync arrives, the data
            repo keeps the history.
          </p>
          <div className="mt-3 flex gap-2">
            {confirmDelete ? (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    void remove(campaign.id).then(() => {
                      navigate('/campaigns');
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete {campaign.name}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmDelete(false);
                  }}
                >
                  Keep it
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                Delete…
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
