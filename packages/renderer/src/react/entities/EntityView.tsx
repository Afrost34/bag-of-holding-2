import type { ReactNode } from 'react';
import {
  castingTime,
  components,
  DAMAGE_TYPES,
  itemProperties,
  itemTypeLine,
  itemValue,
  itemWeight,
  prerequisite,
  spellDuration,
  spellLevelSchool,
  spellRange,
} from '../../format';
import { Entries } from '../Entries';
import { registerInlineEntity } from '../inlineEntity';
import { RichText } from '../RichText';
import { RollLabel, useServices } from '../services';
import { CreatureStatblock } from './CreatureStatblock';

type Obj = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export interface EntityViewProps {
  /** 5etools array name: `spell`, `monster`, `item`… */
  type: string;
  data: Obj;
  edition?: '2014' | '2024';
}

/**
 * The body of an entity: the type-specific header block plus its entries. The page around it
 * (title, source, fluff, images) is the app's job.
 */
export function EntityView({ type, data, edition = '2014' }: EntityViewProps) {
  switch (type) {
    case 'monster':
      return <CreatureStatblock data={data} edition={edition} />;
    case 'spell':
      return <SpellView data={data} edition={edition} />;
    case 'item':
    case 'baseitem':
    case 'magicvariant':
    case 'itemGroup':
      return <ItemView data={data} />;
    default:
      return <GenericView data={data} />;
  }
}

function Facts({ facts }: { facts: [string, ReactNode][] }) {
  const shown = facts.filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (shown.length === 0) return null;
  return (
    <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[15px]">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-bold">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SpellView({ data, edition }: { data: Obj; edition: '2014' | '2024' }) {
  const higher = data.entriesHigherLevel;
  return (
    <RollLabel label={str(data.name)}>
      <p className="text-sm text-muted italic">{spellLevelSchool(data, edition)}</p>
      <Facts
        facts={[
          ['Casting Time', <RichText key="t" text={castingTime(data)} />],
          ['Range', spellRange(data)],
          ['Components', <RichText key="c" text={components(data)} />],
          ['Duration', spellDuration(data)],
        ]}
      />
      <div className="border-t border-accent/40 pt-1">
        <Entries entries={data.entries} depth={1} />
        {higher !== undefined && <Entries entries={higher} depth={2} />}
      </div>
    </RollLabel>
  );
}

function ItemView({ data }: { data: Obj }) {
  const { RollButton } = useServices();
  const dmg1 = str(data.dmg1);
  const damage = dmg1 ? (
    <>
      <RollButton roll={{ kind: 'damage', expression: dmg1, label: str(data.name) ?? 'Damage' }}>
        {dmg1}
      </RollButton>{' '}
      {DAMAGE_TYPES[str(data.dmgType) ?? ''] ?? ''}
    </>
  ) : null;
  const ac =
    typeof data.ac === 'number'
      ? `${String(data.ac)}${str(data.type)?.startsWith('S') ? ' (+)' : ''}`
      : '';
  return (
    <RollLabel label={str(data.name)}>
      <p className="text-sm text-muted italic">{itemTypeLine(data)}</p>
      <Facts
        facts={[
          ['Damage', damage],
          ['Armor Class', ac],
          ['Properties', itemProperties(data)],
          [
            'Mastery',
            <RichText
              key="m"
              text={
                Array.isArray(data.mastery)
                  ? data.mastery.map((m) => `{@itemMastery ${String(m)}}`).join(', ')
                  : ''
              }
            />,
          ],
          ['Weight', itemWeight(data.weight)],
          ['Value', itemValue(data.value)],
        ]}
      />
      <Entries entries={data.entries} depth={1} />
      {data.additionalEntries !== undefined && (
        <Entries entries={data.additionalEntries} depth={1} />
      )}
    </RollLabel>
  );
}

function GenericView({ data }: { data: Obj }) {
  const prereq = data.prerequisite !== undefined ? prerequisite(data.prerequisite) : '';
  return (
    <RollLabel label={str(data.name)}>
      {prereq && (
        <p className="text-sm text-muted italic">
          Prerequisite: <RichText text={prereq} />
        </p>
      )}
      <Entries
        entries={data.entries ?? data.entry ?? (Array.isArray(data.data) ? data.data : undefined)}
        depth={1}
      />
    </RollLabel>
  );
}

registerInlineEntity(EntityView);
