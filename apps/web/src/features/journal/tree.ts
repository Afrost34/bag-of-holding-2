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
      name: kind === 'note' ? base.replace(/\.md$/i, '') : base,
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
