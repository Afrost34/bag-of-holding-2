import type { EntityDetail } from '@boh/data5e';
import { Entries } from '@boh/renderer';
import { cn } from '@boh/ui';
import { useContext, useEffect, useState } from 'react';
import type { BoardCard } from '../../app/boards/model';
import {
  diceParts,
  SCREEN_SECTIONS,
  screenTables,
  type Edition,
  type ScreenSection,
} from '../../app/boards/dmScreen';
import { useCampaigns } from '../../app/campaigns/store';
import { dataWorker } from '../../app/data/client';
import { RollChip } from '../../app/dice/RollChip';
import { JournalViewContext } from '../../app/journal/notes/context';
import { useBoardActions } from './context';

/** The classic DM screen: conditions and actions from the data, quick-reference tables. */
export function ScreenBody({ card }: { card: Extract<BoardCard, { kind: 'screen' }> }) {
  const { update } = useBoardActions();
  const campaignId = useContext(JournalViewContext)?.campaignId;
  const campaignEdition = useCampaigns(
    (s) => s.campaigns.find((c) => c.id === campaignId)?.edition,
  );
  const edition: Edition = campaignEdition === '2014' ? '2014' : '2024';
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Screen sections" className="flex flex-wrap gap-1">
        {SCREEN_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={card.section === s.id}
            onClick={() => {
              update(card.id, (c) => (c.kind === 'screen' ? { ...c, section: s.id } : c));
            }}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              card.section === s.id
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border text-muted hover:bg-sunken hover:text-text',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {card.section === 'conditions' || card.section === 'actions' ? (
        <RulesList
          type={card.section === 'conditions' ? 'condition' : 'action'}
          edition={edition}
        />
      ) : (
        <Tables section={card.section} edition={edition} />
      )}
    </div>
  );
}

function Tables({ section, edition }: { section: ScreenSection; edition: Edition }) {
  return (
    <>
      {screenTables(section, edition).map((t) => (
        <section key={t.title} aria-label={t.title}>
          <h3 className="mb-1 font-serif text-sm font-bold">{t.title}</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                {t.columns.map((c) => (
                  <th key={c} className="px-1 py-0.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.join('|')} className="border-t border-border align-top">
                  {row.map((cell, i) => (
                    <td key={i} className={cn('px-1 py-0.5', i === 0 && 'font-semibold')}>
                      {diceParts(cell).map((p, j) =>
                        p.dice ? (
                          <RollChip
                            key={j}
                            roll={{ kind: 'damage', expression: p.text, label: t.title }}
                          >
                            {p.text}
                          </RollChip>
                        ) : (
                          p.text
                        ),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {t.note && <p className="mt-1 text-xs text-muted">{t.note}</p>}
        </section>
      ))}
    </>
  );
}

/** Core-book entries first, then any other source's; one per name. */
function pick(list: EntityDetail[], edition: Edition): EntityDetail[] {
  const core = edition === '2024' ? 'xphb' : 'phb';
  const byName = new Map<string, EntityDetail>();
  for (const e of list) {
    if (e.edition !== edition) continue;
    const name = e.name.toLowerCase();
    const had = byName.get(name);
    if (!had || (e.source.toLowerCase() === core && had.source.toLowerCase() !== core))
      byName.set(name, e);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Conditions or actions of the edition, each opening to its rules. */
function RulesList({ type, edition }: { type: 'condition' | 'action'; edition: Edition }) {
  const [list, setList] = useState<EntityDetail[] | null>(null);
  useEffect(() => {
    let live = true;
    void dataWorker()
      .ofType(type)
      .then((all) => {
        if (live) setList(pick(all, edition));
      });
    return () => {
      live = false;
    };
  }, [type, edition]);
  if (!list) return <p className="text-sm text-muted">Loading…</p>;
  if (list.length === 0)
    return <p className="text-sm text-muted">None in your data. Download it in Settings → Data.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {list.map((e) => (
        <li key={e.key}>
          <details>
            <summary className="cursor-pointer py-1 font-semibold">{e.name}</summary>
            <div className="pb-2 text-sm">
              <Entries entries={e.data.entries} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
