import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import { useSession } from '../hooks/useSession';
import type { SessionStatus } from '../hooks/useSessionManager';
import type { AgentConfig } from '../hooks/useSettings';
import { useDragResize } from '../hooks/useDragResize';
import { Terminal as TerminalComponent } from './Terminal';
import { AttachBar } from './AttachBar';
import { Composer } from './Composer';
import type { EditorTab } from './EditorTabBar';
import type { FilePreviewData } from './FilePreview';

const COMPOSER_MIN = 80;
const COMPOSER_DEFAULT = 150;

export interface SessionPaneActions {
  sendInput: (data: string) => void;
  openFile: (path: string, isPreview: boolean) => void;
  openDiff: (path: string, staged: boolean) => void;
  addAttachment: (path: string) => void;
  openBrainEntry: (id: string, isPreview: boolean) => void;
  activeFilePath: string | null | undefined;
  activeTabId: string | null;
  attachments: string[];
  // Editor panel state (hoisted to App level)
  tabs: EditorTab[];
  editingTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  closeTab: (id: string) => void;
  promoteTab: (id: string) => void;
  updateTabData: (id: string, data: FilePreviewData) => void;
}

interface SessionPaneProps {
  sessionId: string;
  cwd: string;
  agentConfig: AgentConfig;
  isActive: boolean;
  onStatus: (status: SessionStatus) => void;
  onExit: (code: number) => void;
  onFirstInput: (sessionId: string, text: string) => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
  voiceSlot?: ReactNode;
  brainRefreshTrigger?: () => void;
  ttsEnabled?: boolean;
  onTtsData?: (raw: string) => void;
  /** Called when active — lets App route sidebar and audio actions to this pane */
  onRegisterActions?: (actions: SessionPaneActions) => void;
}

function extractSessionName(raw: string): string {
  return raw.replace(/\r$/, '').replace(/\x1b\[[0-9;]*[mGKH]/g, '').trim().slice(0, 40) || 'Session';
}

export function SessionPane({
  sessionId,
  cwd,
  agentConfig,
  isActive,
  onStatus,
  onExit,
  onFirstInput,
  composerRef,
  voiceSlot,
  brainRefreshTrigger,
  ttsEnabled,
  onTtsData,
  onRegisterActions,
}: SessionPaneProps) {
  const [terminal, setTerminal] = useState<XTerminal | null>(null);
  const hasNamedRef = useRef(false);

  // Drag-resize for composer only — editor panel is hoisted to App level
  const composerPanel = useDragResize(COMPOSER_DEFAULT, COMPOSER_MIN, 'up');

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const session = useSession({
    cwd,
    terminal,
    cols,
    rows,
    agentConfig,
    sessionId,
    onStatus,
    onExit,
    onData: ttsEnabled ? onTtsData : undefined,
  });

  const handleReady = useCallback((t: XTerminal) => setTerminal(t), []);

  const handleSendInput = useCallback((data: string) => {
    if (!hasNamedRef.current && data.replace(/\r$/, '').trim().length > 0) {
      hasNamedRef.current = true;
      onFirstInput(sessionId, extractSessionName(data));
    }
    session.sendInput(data);
  }, [session, sessionId, onFirstInput]);

  // Only send resize when this pane is active to avoid clobbering other sessions' PTY sizes
  const handleSendResize = useCallback((c: number, r: number) => {
    if (isActive) session.sendResize(c, r);
  }, [isActive, session]);

  // Register this pane's actions with App when active — editor panel is rendered at App level
  useEffect(() => {
    if (!isActive) return;
    onRegisterActions?.({
      sendInput: handleSendInput,
      openFile: session.openFile,
      openDiff: session.openDiff,
      addAttachment: session.addAttachment,
      openBrainEntry: session.openBrainEntry,
      activeFilePath: session.activeFilePath,
      activeTabId: session.activeTabId,
      attachments: session.attachments,
      tabs: session.tabs,
      editingTabId: session.editingTabId,
      setActiveTabId: session.setActiveTabId,
      closeTab: session.closeTab,
      promoteTab: session.promoteTab,
      updateTabData: session.updateTabData,
    });
  }); // intentionally no deps — re-register on every render so actions stay fresh

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TerminalComponent onReady={handleReady} sendResize={handleSendResize} />
        </div>
        <div className="resize-handle--h" onMouseDown={composerPanel.onMouseDown} />
        <div className="composer-bottom" style={{ height: composerPanel.width }}>
          <AttachBar attachments={session.attachments} onRemove={session.removeAttachment} />
          <div className="composer-area">
            <Composer
              ref={composerRef}
              onSend={handleSendInput}
              disabled={!session.connected}
              attachments={session.attachments}
              clearAttachments={session.clearAttachments}
              onAttach={session.addAttachments}
              cwd={cwd}
              voiceSlot={voiceSlot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
