import { useState, useCallback } from 'react';
import type { EditorTab } from '../components/EditorTabBar';
import type { FilePreviewData } from '../components/FilePreview';

async function fetchFileContent(cwd: string, filePath: string): Promise<FilePreviewData> {
  try {
    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(relPath)}`);
    if (!res.ok) return { type: 'not-found' };
    return await res.json();
  } catch {
    return { type: 'not-found' };
  }
}

export interface UseEditorTabsReturn {
  tabs: EditorTab[];
  activeTabId: string | null;
  editingTabId: string | null;
  /** Path of the active tab — used by FileTree to highlight the open file */
  activeFilePath: string | null;
  setActiveTabId: (id: string | null) => void;
  openFile: (path: string, isPreview: boolean) => Promise<void>;
  openDiff: (filePath: string, staged: boolean) => Promise<void>;
  closeTab: (id: string) => void;
  promoteTab: (id: string) => void;
  /** Restore tabs from persisted UI state (called on cwd change) */
  restoreFromSaved: (saved: { tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null }, cwd: string) => void;
  /** Clear all tabs (called on cwd change when no saved state exists) */
  reset: () => void;
}

export function useEditorTabs(cwd: string | null): UseEditorTabsReturn {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  const activeFilePath = tabs.find(t => t.id === activeTabId)?.path ?? null;

  const openFile = useCallback(async (path: string, isPreview: boolean) => {
    if (!cwd) return;

    if (isPreview) {
      let alreadyOpen = false;
      setTabs((prev) => {
        if (prev.some((t) => t.path === path)) { alreadyOpen = true; return prev; }
        const existingPreviewIdx = prev.findIndex((t) => t.isPreview);
        if (existingPreviewIdx !== -1) {
          const updated = [...prev];
          updated[existingPreviewIdx] = { id: path, path, isPreview: true, data: null };
          return updated;
        }
        return [...prev, { id: path, path, isPreview: true, data: null }];
      });
      setActiveTabId(path);
      if (alreadyOpen) return;
      const data = await fetchFileContent(cwd, path);
      setTabs((prev) => prev.map((t) => (t.id === path ? { ...t, data } : t)));
    } else {
      let needsFetch = false;
      setTabs((prev) => {
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          if (!existing.isPreview) return prev;
          return prev.map((t) => t.path === path ? { ...t, isPreview: false } : t);
        }
        needsFetch = true;
        return [...prev, { id: path, path, isPreview: false, data: null }];
      });
      setActiveTabId(path);
      if (!needsFetch) return;
      const data = await fetchFileContent(cwd, path);
      setTabs((prev) => prev.map((t) => (t.id === path ? { ...t, data } : t)));
    }
  }, [cwd]);

  const openDiff = useCallback(async (filePath: string, staged: boolean) => {
    if (!cwd) return;
    const tabId = `diff:${staged ? 'staged' : 'unstaged'}:${filePath}`;
    setTabs(prev => {
      if (prev.some(t => t.id === tabId)) return prev;
      return [...prev, { id: tabId, path: filePath, isPreview: false, tabType: 'diff', staged, data: null }];
    });
    setActiveTabId(tabId);

    // Only fetch if not already loaded
    setTabs(prev => {
      const existing = prev.find(t => t.id === tabId);
      if (existing?.data) return prev; // already loaded
      return prev; // will fetch below
    });

    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/git-diff?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(filePath)}&staged=${staged}`);
    const { diff } = await res.json() as { diff: string };
    const data: FilePreviewData = { type: 'diff', content: diff ?? '' };
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, data } : t));
    void relPath;
  }, [cwd]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((currentActive) => {
        if (currentActive !== id) return currentActive;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].id;
      });
      return next;
    });
    setEditingTabId((prev) => (prev === id ? null : prev));
  }, []);

  const promoteTab = useCallback((id: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isPreview: false } : t)));
    setEditingTabId(id);
  }, []);

  const restoreFromSaved = useCallback((
    saved: { tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null },
    cwdForFetch: string,
  ) => {
    const skeletonTabs: EditorTab[] = saved.tabs.map(t => ({
      id: t.path, path: t.path, isPreview: t.isPreview, data: null,
    }));
    setTabs(skeletonTabs);
    setActiveTabId(saved.activeTabId);
    setEditingTabId(null);
    (async () => {
      for (const tab of saved.tabs) {
        const data = await fetchFileContent(cwdForFetch, tab.path);
        setTabs(prev => prev.map(t => t.id === tab.path ? { ...t, data } : t));
      }
    })();
  }, []);

  const reset = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    setEditingTabId(null);
  }, []);

  return {
    tabs,
    activeTabId,
    editingTabId,
    activeFilePath,
    setActiveTabId,
    openFile,
    openDiff,
    closeTab,
    promoteTab,
    restoreFromSaved,
    reset,
  };
}
