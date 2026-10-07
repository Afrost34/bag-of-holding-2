import { createFileRoute } from '@tanstack/react-router';
import { CampaignSettingsPage } from '../features/campaigns/CampaignSettingsPage';

export const Route = createFileRoute('/campaigns_/$id')({
  component: function CampaignSettingsRoute() {
    const { id } = Route.useParams();
    return <CampaignSettingsPage key={id} id={id} />;
  },
});
