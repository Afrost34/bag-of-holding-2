import { cn } from '@boh/ui';
import { Dices } from 'lucide-react';
import { createElement, Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { stripTags } from '../text/splitTags';
import { rollableTable, rowForTotal } from '../text/tableRoll';
import { describeTag } from '../text/tags';
import { inlineEntityView } from './inlineEntity';
import { text } from '../json';
import { RichText } from './RichText';
import { RollLabel, useServices } from './services';

/** A 5etools entry: a string or an object with a `type`. Read defensively; data varies. */
export type Entry = string | number | Record<string, unknown>;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Heading look by depth; `section` entries render one level above depth 0. */
const HEADING: Record<number, string> = {
  [-1]: 'mt-6 mb-3 border-b-2 border-accent/60 pb-1 font-serif text-2xl font-bold',
  0: 'mt-5 mb-2 font-serif text-xl font-bold',
  1: 'mt-4 mb-1.5 font-serif text-lg font-bold',
};

/** Entry types the renderer understands (all types used by the 5etools data). */
export const KNOWN_ENTRY_TYPES = new Set([
  'entries', 'section', 'wrapper', 'options', 'list', 'item', 'itemSub', 'itemSpell', 'table',
  'tableGroup', 'row', 'cell', 'inset', 'insetReadaloud', 'variant', 'variantInner', 'variantSub',
  'spellcasting', 'quote', 'optfeature', 'patron', 'abilityDc', 'abilityAttackMod',
  'abilityGeneric', 'inline', 'inlineBlock', 'bonus', 'bonusSpeed', 'dice', 'link', 'actions',
  'attack', 'ingredient', 'statblockInline', 'statblock', 'image', 'gallery', 'flowchart',
  'flowBlock', 'homebrew', 'code', 'hr', 'wrappedHtml', 'refClassFeature', 'refSubclassFeature',
  'refOptionalfeature', 'refFeat',
]); // prettier-ignore

export function Entries({ entries, depth = 0 }: { entries: unknown; depth?: number }) {
  return (
    <>
      {arr(entries).map((e, i) => (
        <EntryView key={i} entry={e as Entry} depth={depth} />
      ))}
    </>
  );
}

/** Renders entries inline, the first one prefixed with a bold-italic title (`Name.`). */
function TitledParagraphs({
  title,
  entries,
  depth,
}: {
  title: string;
  entries: unknown[];
  depth: number;
}) {
  const [first, ...rest] = entries;
  const titleNode = (
    <strong className="font-bold italic" data-title={stripTags(title)}>
      <RichText text={title} />
      {/[.!?:]$/.test(stripTags(title)) ? '' : '.'}{' '}
    </strong>
  );
  if (typeof first === 'string') {
    return (
      <>
        <p className="my-1.5">
          {titleNode}
          <RichText text={first} />
        </p>
        <Entries entries={rest} depth={depth} />
      </>
    );
  }
  return (
    <>
      <p className="my-1.5">{titleNode}</p>
      <Entries entries={entries} depth={depth} />
    </>
  );
}

export function EntryView({ entry, depth = 0 }: { entry: Entry; depth?: number }): ReactNode {
  if (typeof entry === 'string') {
    return (
      <p className="my-1.5">
        <RichText text={entry} />
      </p>
    );
  }
  if (typeof entry === 'number') return <p className="my-1.5">{entry}</p>;
  if (!isObj(entry)) return null;
  const type = str(entry.type) ?? 'entries';
  const name = str(entry.name);

  switch (type) {
    case 'section':
    case 'entries':
    case 'wrapper':
    case 'options': {
      const level = type === 'section' ? -1 : depth;
      const children = arr(entry.entries);
      const content = !name ? (
        <Entries entries={children} depth={depth + 1} />
      ) : level <= 1 ? (
        <>
          {level <= 0 ? (
            <h2 className={HEADING[level]} data-title={stripTags(name)}>
              <RichText text={name} />
            </h2>
          ) : (
            <h3 className={HEADING[level]} data-title={stripTags(name)}>
              <RichText text={name} />
            </h3>
          )}
          <Entries entries={children} depth={level + 1} />
        </>
      ) : (
        <TitledParagraphs title={name} entries={children} depth={depth + 1} />
      );
      return (
        <RollLabel label={name ? stripTags(name) : undefined}>
          <div id={str(entry.id)}>{content}</div>
        </RollLabel>
      );
    }

    case 'inline':
    case 'inlineBlock':
      return (
        <span>
          {arr(entry.entries).map((e, i) =>
            typeof e === 'string' ? (
              <RichText key={i} text={e} />
            ) : (
              <EntryView key={i} entry={e as Entry} depth={depth} />
            ),
          )}
        </span>
      );

    case 'list':
      return <ListView entry={entry} depth={depth} />;

    case 'item':
    case 'itemSub':
    case 'itemSpell': {
      const body = entry.entries !== undefined ? arr(entry.entries) : arr(entry.entry);
      return name ? (
        <RollLabel label={stripTags(name)}>
          <TitledParagraphs title={name} entries={body} depth={depth + 1} />
        </RollLabel>
      ) : (
        <Entries entries={body} depth={depth + 1} />
      );
    }

    case 'table':
      return <TableView entry={entry} />;
    case 'tableGroup':
      return (
        <div>
          {name && (
            <p className="mt-3 font-serif font-bold">
              <RichText text={name} />
            </p>
          )}
          {arr(entry.tables).map((t, i) => (
            <TableView key={i} entry={t as Obj} />
          ))}
        </div>
      );

    case 'inset':
    case 'insetReadaloud':
    case 'variant':
    case 'variantInner':
    case 'statblockInset':
      return (
        <aside
          className={cn(
            'my-3 rounded-md border-l-4 p-3',
            type === 'insetReadaloud'
              ? 'border-readaloud-border bg-readaloud'
              : 'border-border-strong bg-sunken',
          )}
        >
          {name && (
            <p className="mb-1 font-serif font-bold">
              {type === 'variant' && 'Variant: '}
              <RichText text={name} />
            </p>
          )}
          <RollLabel label={name ? stripTags(name) : undefined}>
            <Entries entries={entry.entries} depth={2} />
          </RollLabel>
        </aside>
      );
    case 'variantSub':
      return <TitledParagraphs title={name ?? ''} entries={arr(entry.entries)} depth={depth + 1} />;

    case 'quote':
      return (
        <blockquote className="my-3 border-l-2 border-border-strong pl-4 italic">
          <Entries entries={entry.entries} depth={depth} />
          {(str(entry.by) ?? str(entry.from)) && (
            <footer className="text-right text-sm not-italic text-muted">
              —{str(entry.by) && <RichText text={str(entry.by) ?? ''} />}
              {str(entry.from) && (
                <>
                  ,{' '}
                  <cite className="italic">
                    <RichText text={str(entry.from) ?? ''} />
                  </cite>
                </>
              )}
            </footer>
          )}
        </blockquote>
      );

    case 'optfeature':
    case 'patron':
      return (
        <div className="my-2">
          <p className="font-bold">
            <RichText text={name ?? ''} />
          </p>
          {str(entry.prerequisite) && (
            <p className="text-sm text-muted italic">
              Prerequisite: <RichText text={str(entry.prerequisite) ?? ''} />
            </p>
          )}
          <Entries entries={entry.entries} depth={depth + 1} />
        </div>
      );

    case 'abilityDc':
    case 'abilityAttackMod': {
      const attrs = arr(entry.attributes).map((a) => ABILITY_NAMES[String(a)] ?? String(a));
      const what = type === 'abilityDc' ? 'save DC' : 'attack modifier';
      const base = type === 'abilityDc' ? '8 + ' : '';
      return (
        <p className="my-2 text-center">
          <strong>
            {name} {what}
          </strong>{' '}
          = {base}your proficiency bonus + your {attrs.join(' or ')} modifier
        </p>
      );
    }
    case 'abilityGeneric':
      return (
        <p className="my-2 text-center">
          {name && <strong>{name} = </strong>}
          <RichText text={str(entry.text) ?? ''} />
          {arr(entry.attributes).length > 0 &&
            ` ${arr(entry.attributes)
              .map((a) => ABILITY_NAMES[String(a)] ?? String(a))
              .join(' or ')} modifier`}
        </p>
      );

    case 'bonus':
      return <>{formatBonus(Number(entry.value))}</>;
    case 'bonusSpeed':
      return <>{formatBonus(Number(entry.value))} ft.</>;

    case 'dice':
      return <DiceEntry entry={entry} />;

    case 'link':
      return <LinkEntry entry={entry} />;

    case 'actions':
      return (
        <RollLabel label={name}>
          <TitledParagraphs title={name ?? ''} entries={arr(entry.entries)} depth={depth + 1} />
        </RollLabel>
      );
    case 'attack':
      return (
        <p className="my-1.5">
          <em>{ATTACK_TYPES[str(entry.attackType) ?? ''] ?? 'Attack:'}</em>{' '}
          {arr(entry.attackEntries).map((e, i) => (
            <Fragment key={i}>{typeof e === 'string' ? <RichText text={e} /> : null} </Fragment>
          ))}
          <em>Hit:</em>{' '}
          {arr(entry.hitEntries).map((e, i) => (
            <Fragment key={i}>{typeof e === 'string' ? <RichText text={e} /> : null} </Fragment>
          ))}
        </p>
      );

    case 'ingredient':
      return (
        <p className="my-1">
          <RichText text={fillAmounts(str(entry.entry) ?? '', entry)} />
        </p>
      );

    case 'spellcasting':
      return <SpellcastingEntry entry={entry} depth={depth} />;

    case 'statblockInline': {
      const data = isObj(entry.data) ? entry.data : {};
      // The registered view is a fixed module-level component, not one created during render.
      const view = inlineEntityView();
      return (
        <div className="my-3 rounded-md border border-border bg-surface-2 p-3">
          {view ? createElement(view, { type: str(entry.dataType) ?? 'monster', data }) : null}
        </div>
      );
    }
    case 'statblock':
      return <StatblockEntry entry={entry} />;

    case 'refClassFeature':
    case 'refSubclassFeature':
    case 'refOptionalfeature':
    case 'refFeat':
      return <RefEntry entry={entry} type={type} />;

    case 'image':
      return <ImageEntry entry={entry} />;
    case 'gallery':
      return (
        <div className="my-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {arr(entry.images).map((img, i) => (
            <ImageEntry key={i} entry={img as Obj} />
          ))}
        </div>
      );

    case 'flowchart':
      return (
        <ol className="my-3 space-y-2">
          {arr(entry.blocks).map((b, i) => (
            <li key={i} className="rounded-md border border-border p-3">
              {str((b as Obj).name) && (
                <p className="font-serif font-bold">
                  <RichText text={str((b as Obj).name) ?? ''} />
                </p>
              )}
              <Entries entries={(b as Obj).entries} depth={2} />
            </li>
          ))}
        </ol>
      );
    case 'flowBlock':
      return (
        <div className="my-2 rounded-md border border-border p-3">
          {name && (
            <p className="font-serif font-bold">
              <RichText text={name} />
            </p>
          )}
          <Entries entries={entry.entries} depth={2} />
        </div>
      );

    case 'homebrew':
      return <Entries entries={entry.entries ?? entry.movedTo} depth={depth} />;
    case 'code':
      return (
        <pre className="my-2 overflow-x-auto rounded-md bg-sunken p-3 text-sm">
          <code>{str(entry.preformatted) ?? ''}</code>
        </pre>
      );
    case 'hr':
      return <hr className="my-4 border-border" />;
    case 'wrappedHtml':
      return null;

    case 'row':
    case 'cell':
      return <Entries entries={entry.row ?? entry.entry} depth={depth} />;

    default:
      // Unknown type: render whatever entries it carries rather than nothing.
      return <Entries entries={entry.entries ?? entry.entry} depth={depth} />;
  }
}

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom',
  cha: 'Charisma', spellcasting: 'spellcasting ability',
}; // prettier-ignore

const ATTACK_TYPES: Record<string, string> = {
  MW: 'Melee Weapon Attack:', RW: 'Ranged Weapon Attack:', MS: 'Melee Spell Attack:',
  RS: 'Ranged Spell Attack:', 'MW,RW': 'Melee or Ranged Weapon Attack:',
}; // prettier-ignore

function formatBonus(n: number): string {
  return n >= 0 ? `+${String(n)}` : `−${String(Math.abs(n))}`;
}

/** Recipe amounts: `{=amount1/v}` → the entry's `amount1`. */
function fillAmounts(text: string, entry: Obj): string {
  return text.replace(/\{=(amount\d+)(?:\/[^}]*)?\}/g, (_m, key: string) => {
    const value = entry[key];
    return typeof value === 'number' ? String(value) : '';
  });
}

const LIST_STYLES: Record<string, string> = {
  'list-hang': 'list-none pl-4 -indent-4',
  'list-hang-notitle': 'list-none pl-4 -indent-4',
  'list-no-bullets': 'list-none',
  'list-decimal': 'list-decimal pl-6',
  'list-lower-roman': 'list-[lower-roman] pl-6',
  'list-upper-roman': 'list-[upper-roman] pl-6',
  'list-lower-alpha': 'list-[lower-alpha] pl-6',
  'list-upper-alpha': 'list-[upper-alpha] pl-6',
};

function ListView({ entry, depth }: { entry: Obj; depth: number }) {
  const style = str(entry.style) ?? '';
  const columns = typeof entry.columns === 'number' ? entry.columns : 1;
  return (
    <ul
      className={cn(
        'my-2 space-y-1',
        LIST_STYLES[style] ?? 'list-disc pl-5 marker:text-accent',
        columns > 1 && 'gap-x-6 sm:columns-2',
      )}
    >
      {arr(entry.items).map((item, i) => (
        <li key={i} className="break-inside-avoid [&>p]:my-0">
          {typeof item === 'string' ? (
            <RichText text={item} />
          ) : (
            <EntryView entry={item as Entry} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function cellRoll(cell: Obj): string | null {
  const roll = isObj(cell.roll) ? cell.roll : null;
  if (!roll) return null;
  const pad = roll.pad === true;
  const fmt = (n: unknown) =>
    pad && typeof n === 'number' && n < 10 ? `0${String(n)}` : String(n);
  if (roll.exact !== undefined) return fmt(roll.exact);
  if (roll.min !== undefined) return `${fmt(roll.min)}–${fmt(roll.max)}`;
  return null;
}

function TableView({ entry }: { entry: Obj }) {
  const { rollDice } = useServices();
  const caption = str(entry.caption);
  const labels = arr(entry.colLabels);
  const rollable = useMemo(() => (rollDice ? rollableTable(entry) : null), [entry, rollDice]);
  const [rolled, setRolled] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const roll = async () => {
    if (!rollable || !rollDice) return;
    const total = await rollDice({
      kind: 'dice',
      expression: rollable.expression,
      label: caption ? stripTags(caption) : 'Random table',
    });
    if (total === null) return;
    const row = rowForTotal(rollable, total);
    setRolled(row);
    rowRefs.current[row]?.scrollIntoView({ block: 'nearest' });
  };
  const styles = arr(entry.colStyles).map(String);
  const align = (i: number) =>
    styles[i]?.includes('text-center')
      ? 'text-center'
      : styles[i]?.includes('text-right')
        ? 'text-right'
        : 'text-left';

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && (
          <caption className="mb-1 text-left font-serif font-bold">
            <RichText text={caption} />
          </caption>
        )}
        {labels.length > 0 && (
          <thead>
            <tr className="border-b-2 border-border-strong">
              {labels.map((l, i) => (
                <th key={i} className={cn('px-2 py-1 font-semibold', align(i))}>
                  {i === 0 && rollable ? (
                    <button
                      type="button"
                      onClick={() => void roll()}
                      aria-label={`Roll ${rollable.expression} on ${caption ? stripTags(caption) : 'this table'}`}
                      title="Roll on this table"
                      className="inline-flex items-center gap-1 rounded border border-dice-border bg-dice-bg px-1.5 font-semibold text-dice-fg hover:brightness-110"
                    >
                      <Dices className="h-3.5 w-3.5" aria-hidden />
                      {stripTags(String(l))}
                    </button>
                  ) : typeof l === 'string' ? (
                    <RichText text={l} />
                  ) : (
                    <EntryView entry={l as Entry} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {arr(entry.rows).map((row, r) => {
            const cells = isObj(row) ? arr(row.row) : arr(row);
            return (
              <tr
                key={r}
                ref={(el) => {
                  rowRefs.current[r] = el;
                }}
                aria-current={rolled === r ? 'true' : undefined}
                className={cn(
                  'odd:bg-surface-2',
                  rolled === r && 'bg-accent-soft! outline-2 -outline-offset-2 outline-accent',
                )}
              >
                {cells.map((cell, c) => (
                  <td key={c} className={cn('px-2 py-1 align-top [&>p]:my-0', align(c))}>
                    {typeof cell === 'string' ? (
                      <RichText text={cell} />
                    ) : typeof cell === 'number' ? (
                      cell
                    ) : isObj(cell) && cell.type === 'cell' ? (
                      (cellRoll(cell) ?? <EntryView entry={cell.entry as Entry} />)
                    ) : (
                      <EntryView entry={cell as Entry} />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {arr(entry.footnotes).map((f, i) => (
        <p key={i} className="mt-1 text-xs text-muted">
          {typeof f === 'string' ? <RichText text={f} /> : null}
        </p>
      ))}
    </div>
  );
}

function DiceEntry({ entry }: { entry: Obj }) {
  const { RollButton } = useServices();
  const parts = arr(entry.toRoll)
    .filter(isObj)
    .map(
      (d) =>
        `${text(d.number) || '1'}d${text(d.faces) || '6'}${d.modifier ? ` + ${text(d.modifier)}` : ''}`,
    );
  const expression = parts.join(' + ') || '1d6';
  return <RollButton roll={{ kind: 'dice', expression }}>{expression}</RollButton>;
}

function LinkEntry({ entry }: { entry: Obj }) {
  const href = isObj(entry.href) ? entry.href : {};
  const text = str(entry.text) ?? '';
  if (href.type === 'external' && typeof href.url === 'string') {
    return (
      <a href={href.url} target="_blank" rel="noreferrer noopener" className="text-link underline">
        {text}
      </a>
    );
  }
  return <span>{text}</span>;
}

/** Widths offered for images in text; the article column is at most ~760 px wide. */
const TEXT_IMAGE_WIDTHS = [480, 800, 1200];

function ImageEntry({ entry }: { entry: Obj }) {
  const { imageUrl } = useServices();
  const [failed, setFailed] = useState(false);
  const href = isObj(entry.href) ? entry.href : {};
  const path = href.type === 'internal' && typeof href.path === 'string' ? href.path : null;
  const original = path ? imageUrl(path) : typeof href.url === 'string' ? href.url : null;
  if (!original) return null;
  const title = str(entry.title);
  const width = typeof entry.width === 'number' ? entry.width : undefined;
  const height = typeof entry.height === 'number' ? entry.height : undefined;
  // A resized copy for the page; the full-size original (maps!) opens on click.
  const sized =
    path && !failed
      ? {
          src: imageUrl(path, 800),
          srcSet: TEXT_IMAGE_WIDTHS.map((w) => `${imageUrl(path, w)} ${String(w)}w`).join(', '),
          sizes: '(min-width: 900px) 760px, 100vw',
        }
      : { src: original };
  return (
    <figure className="my-3">
      <a href={original} target="_blank" rel="noreferrer noopener" title="Open full size">
        <img
          {...sized}
          alt={title ? stripTags(title) : ''}
          loading="lazy"
          decoding="async"
          width={width}
          height={height}
          onError={() => {
            if (!failed) setFailed(true);
          }}
          className="mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-md"
        />
      </a>
      {(title ?? str(entry.credit)) && (
        <figcaption className="mt-1 text-center text-xs text-muted">
          {title && <RichText text={title} />}
          {str(entry.credit) && <span className="block">Art: {str(entry.credit)}</span>}
        </figcaption>
      )}
    </figure>
  );
}

const ORDINAL = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** Creature spellcasting blocks (innate and slot-based). */
function SpellcastingEntry({ entry, depth }: { entry: Obj; depth: number }) {
  const lines: { label: string; spells: unknown[] }[] = [];
  const list = (v: unknown) => arr(v);
  if (entry.constant) lines.push({ label: 'Constant', spells: list(entry.constant) });
  if (entry.will) lines.push({ label: 'At will', spells: list(entry.will) });
  for (const [prop, unit] of [
    ['daily', 'day'],
    ['rest', 'rest'],
    ['restLong', 'long rest'],
    ['weekly', 'week'],
    ['monthly', 'month'],
    ['yearly', 'year'],
    ['charges', 'charge'],
    ['recharge', 'recharge'],
    ['legendary', 'legendary action'],
  ] as const) {
    const group = entry[prop];
    if (!isObj(group)) continue;
    for (const [key, spells] of Object.entries(group).sort(([a], [b]) => b.localeCompare(a))) {
      const each = key.endsWith('e');
      lines.push({
        label: `${key.replace('e', '')}/${unit}${each ? ' each' : ''}`,
        spells: list(spells),
      });
    }
  }
  if (isObj(entry.spells)) {
    for (const [level, info] of Object.entries(entry.spells)) {
      if (!isObj(info)) continue;
      const lvl = Number(level);
      const slots =
        typeof info.slots === 'number'
          ? ` (${String(info.slots)} slot${info.slots === 1 ? '' : 's'})`
          : '';
      const label = lvl === 0 ? 'Cantrips (at will)' : `${ORDINAL[lvl] ?? level} level${slots}`;
      lines.push({ label, spells: list(info.spells) });
    }
  }
  if (entry.ritual) lines.push({ label: 'Rituals', spells: list(entry.ritual) });

  return (
    <RollLabel label={str(entry.name)}>
      <div className="my-1.5">
        {str(entry.name) ? (
          <TitledParagraphs
            title={str(entry.name) ?? ''}
            entries={arr(entry.headerEntries)}
            depth={depth + 1}
          />
        ) : (
          <Entries entries={entry.headerEntries} depth={depth + 1} />
        )}
        {lines.length > 0 && (
          <ul className="my-1 space-y-0.5 pl-4">
            {lines.map((line) => (
              <li key={line.label}>
                <span className="italic">{line.label}:</span>{' '}
                {line.spells.map((s, i) => (
                  <Fragment key={i}>
                    {i > 0 && ', '}
                    {typeof s === 'string' ? (
                      <RichText text={s} />
                    ) : isObj(s) && typeof s.entry === 'string' ? (
                      <RichText text={s.entry} />
                    ) : null}
                  </Fragment>
                ))}
              </li>
            ))}
          </ul>
        )}
        <Entries entries={entry.footerEntries} depth={depth + 1} />
      </div>
    </RollLabel>
  );
}

/** `{type: "statblock", tag, name, source}`: an entity embedded in book text. */
function StatblockEntry({ entry }: { entry: Obj }) {
  const { EmbeddedEntity } = useServices();
  const tag = str(entry.tag) ?? 'creature';
  const name = str(entry.name) ?? '';
  const body = [name, str(entry.source) ?? '', str(entry.displayName) ?? ''].join('|');
  const model = describeTag(tag, body);
  const candidates = model.kind === 'entity' ? model.candidates : [];
  return (
    <div className="my-3">
      <EmbeddedEntity candidates={candidates} tag={tag} name={str(entry.displayName) ?? name} />
    </div>
  );
}

/** Class feature / optional feature references inside class tables and option lists. */
function RefEntry({ entry, type }: { entry: Obj; type: string }) {
  const { EmbeddedEntity } = useServices();
  const [tag, uid] =
    type === 'refClassFeature'
      ? ['classFeature', str(entry.classFeature)]
      : type === 'refSubclassFeature'
        ? ['subclassFeature', str(entry.subclassFeature)]
        : type === 'refFeat'
          ? ['feat', str(entry.feat)]
          : ['optfeature', str(entry.optionalfeature)];
  const model = describeTag(tag, uid ?? '');
  const candidates = model.kind === 'entity' ? model.candidates : [];
  return (
    <EmbeddedEntity candidates={candidates} tag={tag} name={(uid ?? '').split('|')[0] ?? ''} />
  );
}
