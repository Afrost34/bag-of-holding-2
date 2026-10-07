import { useEffect, useState } from 'react';
import { attachmentUrl } from '../../app/journal/attachments';
import { useJournalView } from './context';

/** An attachment's object URL, once it is read. `undefined` while loading, null if missing. */
export function useAttachmentUrl(path: string | null): string | null | undefined {
  const { campaignId } = useJournalView();
  const [state, setState] = useState<{ for: string | null; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    void attachmentUrl(campaignId, path).then((url) => {
      if (live) setState({ for: path, url });
    });
    return () => {
      live = false;
    };
  }, [campaignId, path]);
  if (!path) return null;
  return state?.for === path ? state.url : undefined;
}
