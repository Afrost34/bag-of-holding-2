import { Button, cn } from '@boh/ui';
import { useId, useState } from 'react';
import {
  BUILT_IN_TEMPLATES,
  type CampaignSettings,
  type CampaignTemplate,
} from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { SourceLibrary } from '../../app/data/SourceLibrary';
import { useSourcePrefs } from '../../app/data/sourcePrefs';
import { useAppNavigate } from '../../app/navigation';
import { EditionPicker, fieldLabel, RulesFields } from './CampaignOptions';

/**
 * Every setting of a new campaign: a template fills them in, then each can be changed before
 * creating. The new campaign is opened at once.
 */
export function NewCampaign({ first, onDone }: { first: boolean; onDone: () => void }) {
  const { templates, create } = useCampaigns();
  const navigate = useAppNavigate();
  const nameId = useId();
  const all = [...BUILT_IN_TEMPLATES, ...templates];
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(BUILT_IN_TEMPLATES[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const fromTemplate = (t: CampaignTemplate | undefined): CampaignSettings => ({
    edition: t?.edition ?? '2024',
    rules: { ...(t?.rules ?? { encumbrance: 'off', optionalClassFeatures: true }) },
    // The first campaign keeps the source choices made before campaigns existed.
    sources: {
      ...(first ? useSourcePrefs.getState().overrides : {}),
      ...(t?.sources ?? {}),
    },
  });
  const [settings, setSettings] = useState<CampaignSettings>(() => fromTemplate(all[0]));

  const chooseTemplate = (t: CampaignTemplate) => {
    setTemplateId(t.id);
    setSettings(fromTemplate(t));
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await create(name, settings);
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
      <p className="mt-1 text-sm text-muted">
        A campaign keeps its own sources, rules, notes, bookmarks and journal (and later its
        characters, boards and maps). Everything can be changed later in its settings.
        {first && ' Your current source choices, bookmarks and notes move into it.'}
      </p>
      <form
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor={nameId} className={fieldLabel}>
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
          <legend className={fieldLabel}>Start from a template</legend>
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
                      chooseTemplate(t);
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

        <EditionPicker
          value={settings.edition}
          onChange={(edition) => {
            setSettings({ ...settings, edition });
          }}
        />

        <section aria-label="Rules">
          <h3 className={fieldLabel}>Rules</h3>
          <RulesFields
            value={settings.rules}
            onChange={(rules) => {
              setSettings({ ...settings, rules });
            }}
          />
        </section>

        <SourceLibrary
          title="Sources"
          intro="Click a book to turn it on or off for this campaign."
          overrides={settings.sources}
          onChange={(sources) => {
            setSettings({ ...settings, sources });
          }}
        />

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
