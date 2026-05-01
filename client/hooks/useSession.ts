import { useState, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './usePty';
import { useEditorTabs } from './useEditorTabs';
import type { AgentConfig } from './useSettings';
import type { UseEditorTabsReturn } from './useEditorTabs';

// Everything a single agent session owns.
// When SlopDock grows to support multiple concurrent sessions,
// App renders an array of these — one per session.

export interface UseSessionOptions {
  cwd: string | null;
  terminal: Terminal | null;
  cols: number;
  rows: number;
  agentConfig: AgentConfig;
  /** Called with raw PTY output — used by the audio coordinator for TTS */
  onData?: (raw: string) => void;
}

export interface UseSessionReturn {
  // PTY
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  connected: boolean;
  // Editor tabs (pass through from useEditorTabs)
  tabs: UseEditorTabsReturn['tabs'];
  activeTabId: UseEditorTabsReturn['activeTabId'];
  editingTabId: UseEditorTabsReturn['editingTabId'];
  activeFilePath: UseEditorTabsReturn['activeFilePath'];
  setActiveTabId: UseEditorTabsReturn['setActiveTabId'];
  openFile: UseEditorTabsReturn['openFile'];
  openDiff: UseEditorTabsReturn['openDiff'];
  closeTab: UseEditorTabsReturn['closeTab'];
  promoteTab: UseEditorTabsReturn['promoteTab'];
  restoreFromSaved: UseEditorTabsReturn['restoreFromSaved'];
  resetTabs: UseEditorTabsReturn['reset'];
  // Attachments
  attachments: string[];
  addAttachment: (path: string) => void;
  addAttachments: (paths: string[]) => void;
  removeAttachment: (path: string) => void;
  clearAttachments: () => void;
}

export function useSession({
  cwd,
  terminal,
  cols,
  rows,
  agentConfig,
  onData,
}: UseSessionOptions): UseSessionReturn {
  // PTY
  const { sendInput, sendResize, connected } = usePty({
    cwd,
    terminal,
    cols,
    rows,
    agentConfig,
    onData,
  });

  // Editor tabs
  const editorTabs = useEditorTabs(cwd);

  // Attachments
  const [attachments, setAttachments] = useState<string[]>([]);

  const addAttachment = useCallback((path: string) => {
    setAttachments(prev => prev.includes(path) ? prev : [...prev, path]);
  }, []);

  const addAttachments = useCallback((paths: string[]) => {
    setAttachments(prev => [...prev, ...paths.filter(p => !prev.includes(p))]);
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments(prev => prev.filter(x => x !== path));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  return {
    sendInput,
    sendResize,
    connected,
    tabs: editorTabs.tabs,
    activeTabId: editorTabs.activeTabId,
    editingTabId: editorTabs.editingTabId,
    activeFilePath: editorTabs.activeFilePath,
    setActiveTabId: editorTabs.setActiveTabId,
    openFile: editorTabs.openFile,
    openDiff: editorTabs.openDiff,
    closeTab: editorTabs.closeTab,
    promoteTab: editorTabs.promoteTab,
    restoreFromSaved: editorTabs.restoreFromSaved,
    resetTabs: editorTabs.reset,
    attachments,
    addAttachment,
    addAttachments,
    removeAttachment,
    clearAttachments,
  };
}
