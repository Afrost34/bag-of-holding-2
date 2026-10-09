import { Button } from '@boh/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { Campaign } from '../../app/campaigns/model';
import { useCampaigns } from '../../app/campaigns/store';
import { shrinkImage } from '../../app/shrinkImage';

/** The campaign's cover picture: shown on its card in Campaigns. */
export function CoverPicker({ campaign }: { campaign: Campaign }) {
  const update = useCampaigns((s) => s.update);
  const [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <div className="space-y-3">
      {campaign.cover && (
        <img
          src={campaign.cover}
          alt={`Cover of ${campaign.name}`}
          className="aspect-[3/1] w-full max-w-xl rounded-md object-cover"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={id}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-2"
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          {busy ? 'Reading…' : campaign.cover ? 'Replace the cover' : 'Choose a cover'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          aria-label="Cover picture"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            void shrinkImage(file, 1200)
              .then((cover) => update(campaign.id, { cover }))
              .finally(() => {
                setBusy(false);
              });
          }}
        />
        {campaign.cover && (
          <Button
            variant="ghost"
            onClick={() => {
              void update(campaign.id, { cover: '' });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
