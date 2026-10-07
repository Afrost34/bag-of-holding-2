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
