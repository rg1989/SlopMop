import { useState, useRef, useEffect } from 'react';

// SVG eye-off icon for hidden (dotfile) entries
function EyeOffIcon() {
  return (
    <svg
      className="ft-hidden-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="hidden file"
      style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0, opacity: 0.55 }}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Returns true if the node or any of its descendants is in changedPaths. */
function hasChangedDescendant(node: FileNode, changedPaths: Set<string>): boolean {
  if (node.type === 'file') return changedPaths.has(node.path);
  if (!node.children) return false;
  return node.children.some((child) => hasChangedDescendant(child, changedPaths));
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  hidden?: boolean; // true for dotfiles/dotdirs
  children?: FileNode[];
}

interface FileTreeNodeProps {
  node: FileNode;
  selected: Set<string>;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
  onOpen?: (path: string) => void;
  changedPaths: Set<string>;
  mode: 'all' | 'changes';
  activePath?: string;
  depth?: number;
}

function FileTreeNode({
  node,
  selected,
  onSelect,
  onPreview,
  onOpen,
  changedPaths,
  mode,
  activePath,
  depth = 0,
}: FileTreeNodeProps) {
  const [open, setOpen] = useState(true);

  if (node.type === 'dir') {
    // In Changes mode, prune directories that contain no changed descendants
    if (mode === 'changes' && !hasChangedDescendant(node, changedPaths)) {
      return null;
    }
    return (
      <li className="ft-dir">
        <div
          className="ft-dir-header"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="ft-caret">{open ? '▾' : '▸'}</span>
          {node.hidden && <EyeOffIcon />}
          <span className="ft-name">{node.name}</span>
        </div>
        {open && node.children && node.children.length > 0 && (
          <ul className="ft-tree">
            {node.children.map((child) => {
              // In 'changes' mode, skip file nodes not in changedPaths (dirs handled by recursive pruning)
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
                  onOpen={onOpen}
                  changedPaths={changedPaths}
                  mode={mode}
                  activePath={activePath}
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
  const isActive = node.path === activePath;
  const classNames = [
    'ft-file',
    isSelected ? 'ft-selected' : '',
    isChanged ? 'ft-changed' : '',
    node.hidden ? 'ft-hidden' : '',
    isActive ? 'ft-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={classNames}
      data-path={node.path}
      style={{ paddingLeft: `${24 + depth * 12}px` }}
      onClick={() => onPreview(node.path)}
      onDoubleClick={() => {
        onSelect(node.path);
        onOpen?.(node.path);
      }}
    >
      {node.hidden && <EyeOffIcon />}
      {node.name}
    </li>
  );
}

interface FileTreeProps {
  nodes: FileNode[];
  selected: Set<string>;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
  onOpen?: (path: string) => void;
  changedPaths: Set<string>;
  mode?: 'all' | 'changes';
  activePath?: string;
}

export function FileTree({
  nodes,
  selected,
  onSelect,
  onPreview,
  onOpen,
  changedPaths,
  mode = 'all',
  activePath,
}: FileTreeProps) {
  const rootRef = useRef<HTMLUListElement>(null);

  // Scroll active file into view when activePath changes
  useEffect(() => {
    if (!activePath || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(`li[data-path="${CSS.escape(activePath)}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activePath]);

  // In Changes mode with no changed files, show empty state
  if (mode === 'changes' && changedPaths.size === 0) {
    return <p className="ft-empty">Working tree clean</p>;
  }

  return (
    <ul className="ft-tree" ref={rootRef}>
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
            onOpen={onOpen}
            changedPaths={changedPaths}
            mode={mode}
            activePath={activePath}
          />
        );
      })}
    </ul>
  );
}
