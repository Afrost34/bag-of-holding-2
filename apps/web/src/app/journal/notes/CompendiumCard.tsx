import { parseCompendiumRef, parseLinkInner } from '@boh/journal';
import { useEffect, useState } from 'react';
import { useEntity } from '../../data/entities';
import { resolveCompendiumRef } from '../compendium';
import { EntityCard } from '../../renderer/EntityCard';
import { useJournalView } from './context';

const box = 'rounded-lg border border-border bg-surface p-3 text-sm';

/** The compendium entry a `[[spell:Fireball]]` link or embed points at, as a card. */
export function CompendiumCard({ inner, compact = false }: { inner: string; compact?: boolean }) {
  const { edition } = useJournalView();
  const ref = parseCompendiumRef(parseLinkInner(inner).target);
  const [resolved, setResolved] = useState<{ for: string; key: string | null } | null>(null);
  useEffect(() => {
    if (!ref) return;
    let live = true;
    void resolveCompendiumRef(ref, edition).then((key) => {
      if (live) setResolved({ for: inner, key });
    });
    return () => {
      live = false;
    };
    // `ref` is derived from `inner`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inner, edition]);
  const key = resolved?.for === inner ? resolved.key : undefined;
  const entity = useEntity(key ?? null);
  if (key === undefined || (key && entity.status === 'loading')) {
    return <div className={`${box} text-muted`}>Loading…</div>;
  }
  if (key === null || entity.status !== 'found') {
    return (
      <div className={`${box} text-muted`}>
        “{ref?.name}” is not in your data (or its source is turned off).
      </div>
    );
  }
  return (
    <div className="text-sm">
      <EntityCard entity={entity.entity} compact={compact} />
    </div>
  );
}
