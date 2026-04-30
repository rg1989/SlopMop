import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileNode } from '../components/FileTree';

const POLL_INTERVAL = 3000;

export function useFileTree(cwd: string | null) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'all' | 'changes'>('all');
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const loadTree = useCallback(() => {
    if (!cwd) { setTree([]); return; }
    fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { tree: FileNode[] }) => setTree(data.tree))
      .catch(() => {});
  }, [cwd]);

  const loadChanges = useCallback(() => {
    if (!cwd) return;
    fetch(`/api/git-status?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { changed: string[] }) => setChangedPaths(new Set(data.changed)))
      .catch(() => setChangedPaths(new Set()));
  }, [cwd]);

  // Initial load + polling
  useEffect(() => {
    if (!cwd) { setTree([]); setChangedPaths(new Set()); return; }
    loadTree();
    const id = setInterval(() => {
      loadTree();
      if (modeRef.current === 'changes') loadChanges();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [cwd, loadTree, loadChanges]);

  // Fetch git status immediately when mode switches to 'changes'
  useEffect(() => {
    if (mode === 'changes') loadChanges();
  }, [mode, loadChanges]);

  return { tree, changedPaths, mode, setMode };
}
