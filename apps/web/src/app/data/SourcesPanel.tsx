import { useActiveCampaign } from '../campaigns/store';
import { SourceLibrary } from './SourceLibrary';
import { useSourcePrefs } from './sourcePrefs';

/** The open campaign's sources (or the app-wide ones before any campaign exists). */
export function SourcesPanel() {
  const overrides = useSourcePrefs((s) => s.overrides);
  const campaign = useActiveCampaign();
  return (
    <SourceLibrary
      title={campaign ? `Sources · ${campaign.name}` : 'Sources'}
      intro={
        campaign
          ? `Click a book to turn it on or off for ${campaign.name}. Turned-off sources are hidden everywhere while it is open; each campaign keeps its own list.`
          : 'Click a book to turn it on or off. Turned-off sources are hidden everywhere; once you create a campaign, it keeps its own list.'
      }
      overrides={overrides}
      onChange={(next) => {
        // The active campaign saves its copy (see the subscription in campaigns/store).
        useSourcePrefs.setState({ overrides: next });
      }}
    />
  );
}
