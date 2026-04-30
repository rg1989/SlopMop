import { useState, useEffect, useCallback } from 'react';
import type { FileNode } from '../components/FileTree';

export function useFileTree(cwd: string | null) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'all' | 'changes'>('all');

  // Fetch file tree when cwd changes
  useEffect(() => {
    if (!cwd) {
      setTree([]);
      return;
    }
    fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { tree: FileNode[] }) => setTree(data.tree))
      .catch(() => setTree([]));
  }, [cwd]);

  // Load git-changed paths
  const loadChanges = useCallback(() => {
    if (!cwd) return;
    fetch(`/api/git-status?cwd=${encodeURIComponent(cwd)}`)
      .then((res) => res.json())
      .then((data: { changed: string[] }) => setChangedPaths(new Set(data.changed)))
      .catch(() => setChangedPaths(new Set()));
  }, [cwd]);

  // Fetch git status when mode switches to 'changes'
  useEffect(() => {
    if (mode === 'changes') {
      loadChanges();
    }
  }, [mode, loadChanges]);

  return { tree, changedPaths, mode, setMode };
}
