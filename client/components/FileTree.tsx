import { useState } from 'react';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

interface FileTreeNodeProps {
  node: FileNode;
  selected: Set<string>;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
  changedPaths: Set<string>;
  mode: 'all' | 'changes';
  depth?: number;
}

function FileTreeNode({
  node,
  selected,
  onSelect,
  onPreview,
  changedPaths,
  mode,
  depth = 0,
}: FileTreeNodeProps) {
  const [open, setOpen] = useState(true);

  if (node.type === 'dir') {
    return (
      <li className="ft-dir">
        <div
          className="ft-dir-header"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="ft-caret">{open ? '▾' : '▸'}</span>
          <span className="ft-name">{node.name}</span>
        </div>
        {open && node.children && node.children.length > 0 && (
          <ul className="ft-tree">
            {node.children.map((child) => {
              // In 'changes' mode, skip file nodes not in changedPaths
              if (mode === 'changes' && child.type === 'file' && !changedPaths.has(child.path)) {
                return null;
              }
              return (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  selected={selected}
                  onSelect={onSelect}
                  onPreview={onPreview}
                  changedPaths={changedPaths}
                  mode={mode}
                  depth={depth + 1}
                />
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  // File node
  const isSelected = selected.has(node.path);
  const isChanged = changedPaths.has(node.path);
  const classNames = [
    'ft-file',
    isSelected ? 'ft-selected' : '',
    isChanged ? 'ft-changed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={classNames}
      style={{ paddingLeft: `${24 + depth * 12}px` }}
      onClick={() => onPreview(node.path)}
      onDoubleClick={() => onSelect(node.path)}
    >
      {node.name}
    </li>
  );
}

interface FileTreeProps {
  nodes: FileNode[];
  selected: Set<string>;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
  changedPaths: Set<string>;
  mode?: 'all' | 'changes';
}

export function FileTree({
  nodes,
  selected,
  onSelect,
  onPreview,
  changedPaths,
  mode = 'all',
}: FileTreeProps) {
  return (
    <ul className="ft-tree">
      {nodes.map((node) => {
        // In 'changes' mode, skip top-level file nodes not in changedPaths
        if (mode === 'changes' && node.type === 'file' && !changedPaths.has(node.path)) {
          return null;
        }
        return (
          <FileTreeNode
            key={node.path}
            node={node}
            selected={selected}
            onSelect={onSelect}
            onPreview={onPreview}
            changedPaths={changedPaths}
            mode={mode}
          />
        );
      })}
    </ul>
  );
}
