import { describe, expect, it } from 'vitest';
import { campaignNpcs } from './npcs';

describe('campaign NPCs for encounters', () => {
  it('are the notes of any kind that name a stat block', () => {
    const notes = new Map([
      ['NPCs/Clank.md', '---\ntype: npc\nstat_block: "[[creature:Spy@XMM|Spy]]"\n---\nBody'],
      [
        'NPCs/Old Iron Hestia.md',
        '---\ntype: npc\ntitle: Old Iron Hestia\nstat_block: "[[creature:Veteran Warrior@XMM]]"\n---\n',
      ],
      ['NPCs/Nameless.md', '---\ntype: npc\n---\n'],
      ['Locations/Iron Mule.md', '---\ntype: location\nstat_block: "[[creature:Spy@XMM]]"\n---\n'],
      ['Ships/Sea Hag.md', '---\ntype: ship\ncrew: "[[creature:Pirate@XMM|Pirate]]"\n---\n'],
      ['NPCs/Vague.md', '---\ntype: npc\nstat_block: "[[creature:Spy]]"\n---\n'],
    ]);
    expect(campaignNpcs(notes)).toEqual([
      { note: 'NPCs/Clank.md', name: 'Clank', statBlock: 'monster:spy@xmm' },
      { note: 'Locations/Iron Mule.md', name: 'Iron Mule', statBlock: 'monster:spy@xmm' },
      {
        note: 'NPCs/Old Iron Hestia.md',
        name: 'Old Iron Hestia',
        statBlock: 'monster:veteran warrior@xmm',
      },
      { note: 'Ships/Sea Hag.md', name: 'Sea Hag', statBlock: 'monster:pirate@xmm' },
    ]);
  });
});
