import { cn } from '@boh/ui';
import type { ReactNode } from 'react';
import { splitTags } from '../text/splitTags';
import { describeTag, type FormatKind, type TagModel } from '../text/tags';
import { useRollLabel, useServices } from './services';

const FORMAT_CLASS: Record<FormatKind, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'line-through',
  sup: 'align-super text-[0.75em]',
  sub: 'align-sub text-[0.75em]',
  kbd: 'rounded border border-border bg-sunken px-1 font-mono text-[0.85em]',
  code: 'rounded bg-sunken px-1 font-mono text-[0.9em]',
  note: 'italic text-muted',
  highlight: 'rounded-sm bg-dice-bg px-0.5',
  smallCaps: '[font-variant:small-caps]',
  plain: '',
};

/** Renders a 5etools string: plain text with nested `{@tags}`. */
export function RichText({ text }: { text: string }) {
  return <>{renderSegments(text)}</>;
}

function renderSegments(text: string): ReactNode[] {
  return splitTags(text).map((seg, i) =>
    seg.kind === 'text' ? seg.text : <Tag key={i} model={describeTag(seg.name, seg.body)} />,
  );
}

function Tag({ model }: { model: TagModel }) {
  const { EntityLink, RollButton, ReferenceLink, imageUrl } = useServices();
  const contextLabel = useRollLabel();

  switch (model.kind) {
    case 'format': {
      const content = renderSegments(model.content);
      if (model.format === 'sup') return <sup>{content}</sup>;
      if (model.format === 'sub') return <sub>{content}</sub>;
      if (model.format === 'kbd') return <kbd className={FORMAT_CLASS.kbd}>{content}</kbd>;
      if (model.format === 'code') return <code className={FORMAT_CLASS.code}>{content}</code>;
      return (
        <span
          className={cn(FORMAT_CLASS[model.format])}
          style={
            model.color
              ? { color: model.color.startsWith('#') ? model.color : `#${model.color}` }
              : undefined
          }
        >
          {content}
        </span>
      );
    }
    case 'entity':
      return (
        <EntityLink candidates={model.candidates} tag={model.tag}>
          {renderSegments(model.display)}
        </EntityLink>
      );
    case 'roll': {
      const label = model.roll.label ?? contextLabel;
      return (
        <RollButton roll={label === undefined ? model.roll : { ...model.roll, label }}>
          {renderSegments(model.display)}
        </RollButton>
      );
    }
    case 'label':
      // Labels like "Hit:" precede text directly in the data ("{@h}5 (1d6 + 2)").
      return model.italic ? (
        <>
          <em>{model.text}</em>{' '}
        </>
      ) : (
        <>{model.text}</>
      );
    case 'reference':
      return <ReferenceLink reference={model}>{renderSegments(model.display)}</ReferenceLink>;
    case 'external':
      return (
        <a
          href={model.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-link underline"
        >
          {renderSegments(model.display)}
        </a>
      );
    case 'image':
      return (
        <a
          href={imageUrl(model.path)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-link underline"
        >
          {renderSegments(model.display)}
        </a>
      );
    case 'tooltip':
      return (
        <span
          title={model.tip}
          className="cursor-help underline decoration-dotted underline-offset-2"
        >
          {renderSegments(model.display)}
        </span>
      );
    case 'unknown':
      return <>{renderSegments(model.display)}</>;
  }
}
