import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { parseTable, tableSource } from './editor/livePreview';

/**
 * A table in a note, edited in place: type in the cells, and add or remove rows and columns from
 * the menu. Each change is written back to the note as a Markdown table.
 */
export function TableEditor({
  source,
  onChange,
}: {
  source: string;
  onChange: (source: string) => void;
}) {
  const [rows, setRows] = useState(() => normalise(parseTable(source)));
  const cols = rows[0]?.length ?? 1;

  const commit = (next: string[][]) => {
    setRows(next);
    onChange(tableSource(next));
  };
  const setCell = (r: number, c: number, value: string) => {
    setRows((current) =>
      current.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row)),
    );
  };

  return (
    <div className="group/table relative my-1 inline-block max-w-full overflow-x-auto">
      <table className="border-collapse text-[0.95em]">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const Cell = r === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={c}
                    className={cn('border border-border p-0', r === 0 && 'bg-sunken font-semibold')}
                  >
                    <input
                      aria-label={`Row ${String(r + 1)}, column ${String(c + 1)}`}
                      value={cell}
                      onChange={(e) => {
                        setCell(r, c, e.target.value);
                      }}
                      onBlur={() => {
                        onChange(tableSource(rows));
                      }}
                      onKeyDown={(e) => {
                        // Enter adds a row below the last one, as in a spreadsheet.
                        if (e.key === 'Enter' && r === rows.length - 1) {
                          e.preventDefault();
                          commit([...rows, Array.from({ length: cols }, () => '')]);
                        }
                      }}
                      className={cn(
                        'w-full min-w-24 bg-transparent px-2.5 py-1 focus:bg-accent-soft focus:outline-none',
                        r === 0 && 'font-semibold',
                      )}
                    />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Menu.Root modal={false}>
        <Menu.Trigger
          aria-label="Table options"
          className="absolute top-0 right-0 rounded bg-surface p-0.5 text-faint opacity-60 shadow-card hover:text-text group-hover/table:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-44 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
          >
            <Item
              onSelect={() => {
                commit([...rows, Array.from({ length: cols }, () => '')]);
              }}
            >
              Add a row
            </Item>
            <Item
              onSelect={() => {
                commit(rows.map((row) => [...row, '']));
              }}
            >
              Add a column
            </Item>
            <Item
              disabled={rows.length <= 2}
              onSelect={() => {
                commit(rows.slice(0, -1));
              }}
            >
              Remove the last row
            </Item>
            <Item
              disabled={cols <= 1}
              onSelect={() => {
                commit(rows.map((row) => row.slice(0, -1)));
              }}
            >
              Remove the last column
            </Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

/** Every row as long as the longest. */
function normalise(rows: string[][]): string[][] {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const filled = rows.length > 0 ? rows : [['']];
  return filled.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
}

function Item({
  onSelect,
  disabled,
  children,
}: {
  onSelect: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <Menu.Item
      disabled={disabled === true}
      onSelect={onSelect}
      className="cursor-pointer rounded px-2 py-1.5 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-sunken"
    >
      {children}
    </Menu.Item>
  );
}
