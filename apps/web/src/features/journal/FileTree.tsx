import { cn } from '@boh/ui';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Paperclip,
} from 'lucide-react';
import { useState } from 'react';
import { buildTree, type TreeNode } from './tree';

export interface FileTreeProps {
  notes: readonly string[];
  attachments: readonly string[];
  folders: readonly string[];
  /** The open note. */
  current: string | null;
  onOpen: (path: string) => void;
  onNewNote: (folder: string) => void;
  onNewFolder: (parent: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string, kind: 'folder' | 'note' | 'file') => void;
}

export function FileTree(props: FileTreeProps) {
  const tree = buildTree(props.notes, props.attachments, props.folders);
  return (
    <nav aria-label="Journal files" className="text-sm">
      <div className="mb-2 flex items-center gap-1 px-2">
        <span className="flex-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
          Files
        </span>
        <button
          type="button"
          aria-label="New note"
          title="New note"
          onClick={() => {
            props.onNewNote('');
          }}
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <FilePlus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="New folder"
          title="New folder"
          onClick={() => {
            props.onNewFolder('');
          }}
          className="rounded p-1 text-muted hover:bg-sunken hover:text-text"
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {tree.length === 0 ? (
        <p className="px-3 py-2 text-muted">No notes yet.</p>
      ) : (
        <ul role="tree" aria-label="Notes">
          {tree.map((n) => (
            <TreeItem key={n.path} node={n} depth={0} {...props} />
          ))}
        </ul>
      )}
    </nav>
  );
}

function TreeItem({ node, depth, ...props }: FileTreeProps & { node: TreeNode; depth: number }) {
  const containsCurrent = props.current?.startsWith(`${node.path}/`) ?? false;
  const [open, setOpen] = useState(depth === 0 || containsCurrent);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.name);
  const isOpen = open || containsCurrent;
  const Icon = node.kind === 'folder' ? Folder : node.kind === 'note' ? FileText : Paperclip;
  const selected = node.path === props.current;

  const commitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== node.name) props.onRename(node.path, trimmed);
    else setName(node.name);
  };

  return (
    <li
      role="treeitem"
      aria-expanded={node.kind === 'folder' ? isOpen : undefined}
      aria-selected={selected}
    >
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md pr-1',
          selected ? 'bg-accent-soft text-accent' : 'hover:bg-sunken',
        )}
        style={{ paddingLeft: `${String(0.25 + depth * 0.85)}rem` }}
      >
        {renaming ? (
          <input
            autoFocus
            value={name}
            aria-label={`New name for ${node.name}`}
            onChange={(e) => {
              setName(e.target.value);
            }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setName(node.name);
                setRenaming(false);
              }
            }}
            className="my-0.5 h-7 min-w-0 flex-1 rounded border border-accent bg-surface px-1.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (node.kind === 'folder') setOpen(!isOpen);
              else if (node.kind === 'note') props.onOpen(node.path);
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
          >
            {node.kind === 'folder' ? (
              <ChevronRight
                className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')}
                aria-hidden
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <Icon className="h-4 w-4 shrink-0 text-faint" aria-hidden />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        <Menu.Root>
          <Menu.Trigger
            aria-label={`Actions for ${node.name}`}
            className="rounded p-0.5 text-faint opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="start"
              sideOffset={4}
              className="z-50 min-w-40 rounded-md border border-border bg-surface p-1 text-sm shadow-card"
            >
              {node.kind === 'folder' && (
                <>
                  <MenuItem
                    onSelect={() => {
                      props.onNewNote(node.path);
                    }}
                  >
                    New note here
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      props.onNewFolder(node.path);
                    }}
                  >
                    New folder here
                  </MenuItem>
                </>
              )}
              <MenuItem
                onSelect={() => {
                  setRenaming(true);
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  props.onDelete(node.path, node.kind);
                }}
              >
                Delete
              </MenuItem>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      {node.kind === 'folder' && isOpen && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((c) => (
            <TreeItem key={c.path} node={c} depth={depth + 1} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}

function MenuItem({ onSelect, children }: { onSelect: () => void; children: string }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
    >
      {children}
    </Menu.Item>
  );
}
