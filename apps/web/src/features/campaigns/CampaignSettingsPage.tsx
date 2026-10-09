import { Button, Panel } from '@boh/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { AppLink } from '../../app/AppLink';
import type { Campaign } from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { SourceLibrary } from '../../app/data/SourceLibrary';
import { useAppNavigate } from '../../app/navigation';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { CoverPicker } from './CoverPicker';
import { EditionPicker, fieldLabel, RulesFields } from './CampaignOptions';

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
    <div className="h-full overflow-y-auto after:block after:h-16 after:content-['']">
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
              <label htmlFor={nameId} className={fieldLabel}>
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
            <EditionPicker
              value={campaign.edition}
              onChange={(edition) => void update(campaign.id, { edition })}
            />
          </div>
        </Panel>

        <Panel title="Cover picture">
          <CoverPicker campaign={campaign} />
        </Panel>

        <Panel title="Rules">
          <RulesFields
            value={campaign.rules}
            onChange={(rules) => void update(campaign.id, { rules })}
          />
        </Panel>

        <SourceLibrary
          title={`Sources · ${campaign.name}`}
          overrides={campaign.sources}
          onChange={(sources) => void update(campaign.id, { sources })}
        />

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
