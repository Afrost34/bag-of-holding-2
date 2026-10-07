/** The journal's files as a tree for the sidebar. */

export interface TreeNode {
  name: string;
  path: string;
  kind: 'folder' | 'note' | 'file';
  children: TreeNode[];
}

/** Folders first, then notes and files, alphabetically (like Obsidian). */
export function buildTree(
  notes: readonly string[],
  attachments: readonly string[],
  folders: readonly string[],
): TreeNode[] {
  const root: TreeNode = { name: '', path: '', kind: 'folder', children: [] };
  const folderNode = (path: string): TreeNode => {
    if (!path) return root;
    const parent = folderNode(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    let node = parent.children.find((c) => c.kind === 'folder' && c.path === path);
    if (!node) {
      node = { name: path.slice(path.lastIndexOf('/') + 1), path, kind: 'folder', children: [] };
      parent.children.push(node);
    }
    return node;
  };
  for (const f of folders) folderNode(f);
  const add = (path: string, kind: 'note' | 'file') => {
    const parent = folderNode(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    const base = path.slice(path.lastIndexOf('/') + 1);
    parent.children.push({
      name: kind === 'note' ? base.replace(/\.md$/i, '') : base.replace(/\.base$/i, ''),
      path,
      kind,
      children: [],
    });
  };
  notes.forEach((p) => {
    add(p, 'note');
  });
  attachments.forEach((p) => {
    add(p, 'file');
  });
  const sort = (n: TreeNode) => {
    n.children.sort(
      (a, b) =>
        Number(b.kind === 'folder') - Number(a.kind === 'folder') ||
        a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }),
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

export type MoveResult = { ok: true; to: string } | { ok: false; reason: string };

/**
 * Where `path` (a note, file or folder) ends up when dropped on `folder` ('' is the top level).
 * Refuses moves that change nothing, put a folder inside itself, or would overwrite something.
 */
export function moveTarget(
  path: string,
  folder: string,
  existing: readonly string[],
  isFolder: boolean,
): MoveResult {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const current = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  if (folder === current) return { ok: false, reason: 'It is already there.' };
  if (isFolder && (folder === path || folder.startsWith(`${path}/`))) {
    return { ok: false, reason: 'A folder cannot go inside itself.' };
  }
  const to = folder ? `${folder}/${name}` : name;
  if (existing.some((p) => p.toLowerCase() === to.toLowerCase())) {
    return {
      ok: false,
      reason: `“${folder || 'Journal'}” already has something called “${name}”.`,
    };
  }
  return { ok: true, to };
}

export interface TagNode {
  /** The full tag, e.g. `faction/zhentarim`. */
  tag: string;
  /** The last part, shown in the tree: `zhentarim`. */
  name: string;
  /** Notes with this tag (not counting sub-tags). */
  notes: string[];
  /** Notes with this tag or one of its sub-tags. */
  count: number;
  children: TagNode[];
}

/** Tags as a tree (`faction/zhentarim` under `faction`), alphabetical, case-insensitive. */
export function buildTagTree(tagsByNote: ReadonlyMap<string, readonly string[]>): TagNode[] {
  const nodes = new Map<string, TagNode & { all: Set<string> }>();
  const node = (tag: string) => {
    const key = tag.toLowerCase();
    let n = nodes.get(key);
    if (!n) {
      n = {
        tag,
        name: tag.slice(tag.lastIndexOf('/') + 1),
        notes: [],
        count: 0,
        children: [],
        all: new Set(),
      };
      nodes.set(key, n);
      const parent = tag.includes('/') ? tag.slice(0, tag.lastIndexOf('/')) : null;
      if (parent) node(parent).children.push(n);
    }
    return n;
  };
  for (const [path, tags] of tagsByNote) {
    for (const tag of tags) {
      node(tag).notes.push(path);
      const parts = tag.split('/');
      parts.forEach((_, i) => node(parts.slice(0, i + 1).join('/')).all.add(path));
    }
  }
  const compare = (a: TagNode, b: TagNode) =>
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
  for (const n of nodes.values()) {
    n.count = n.all.size;
    n.children.sort(compare);
    n.notes.sort((a, b) => a.localeCompare(b));
  }
  return [...nodes.values()]
    .filter((n) => !n.tag.includes('/'))
    .sort(compare)
    .map(function strip(n): TagNode {
      return {
        tag: n.tag,
        name: n.name,
        notes: n.notes,
        count: n.count,
        children: n.children.map((c) => strip(c as TagNode & { all: Set<string> })),
      };
    });
}
