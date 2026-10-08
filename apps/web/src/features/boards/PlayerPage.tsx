import { useEffect, useState } from 'react';
import { usePlayerWindow } from '../../app/boards/player';
import { useBoards } from '../../app/boards/store';
import { useActiveCampaign, useCampaigns } from '../../app/campaigns/store';
import { BoardPage } from './BoardPage';

/**
 * The player window: the campaign's players' board, a full board (cards moved, resized, rolled,
 * added, removed) on the screen the players see. The DM sends it cards from boards, the
 * compendium or the calendar; it is the only window that writes this board while it is open.
 */
export function PlayerPage() {
  useEffect(() => {
    document.title = 'Bag of Holding — players';
  }, []);
  const { loaded: campaignsLoaded, load: loadCampaigns } = useCampaigns();
  const active = useActiveCampaign();
  const ensurePlayers = useBoards((s) => s.ensurePlayers);
  /** The campaign whose board shows: the last one cards came from, else the open campaign. */
  const [sentFrom, setSentFrom] = useState<{ campaign: string | undefined } | null>(null);
  const campaign = sentFrom ? sentFrom.campaign : active?.id;
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignsLoaded) void loadCampaigns();
  }, [campaignsLoaded, loadCampaigns]);
  useEffect(() => {
    if (!campaignsLoaded) return;
    let live = true;
    void ensurePlayers(campaign).then((b) => {
      if (live) setBoardId(b.id);
    });
    return () => {
      live = false;
    };
  }, [campaignsLoaded, campaign, ensurePlayers]);

  usePlayerWindow((contents, from) => {
    setSentFrom({ campaign: from });
    void useBoards
      .getState()
      .ensurePlayers(from)
      .then((b) => {
        useBoards.getState().send(b.id, contents);
      });
  });

  if (!boardId) return <p className="p-8 text-muted">Opening the players’ board…</p>;
  return <BoardPage id={boardId} />;
}
