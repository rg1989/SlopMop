import { useState, useCallback, useEffect, useRef } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import { useSession } from '../hooks/useSession';
import type { SessionStatus } from '../hooks/useSessionManager';
import type { AgentConfig } from '../hooks/useSettings';
import { useDragResize } from '../hooks/useDragResize';
import { Terminal as TerminalComponent } from './Terminal';
import { EditorTabBar } from './EditorTabBar';
import { AttachBar } from './AttachBar';
import { Composer } from './Composer';
import { FilePreview } from './FilePreview';
import { BrainEntryView } from './BrainEntryView';
import type { BrainEntryData } from './BrainEntryView';

const PREVIEW_MIN = 180;
const PREVIEW_DEFAULT = 320;
const COMPOSER_MIN = 80;
const COMPOSER_DEFAULT = 150;
const TERMINAL_MIN = 140;
const RESIZE_HANDLE_WIDTH = 4;

export interface SessionPaneActions {
  sendInput: (data: string) => void;
  openFile: (path: string, isPreview: boolean) => void;
  openDiff: (path: string, staged: boolean) => void;
  addAttachment: (path: string) => void;
  openBrainEntry: (id: string, isPreview: boolean) => void;
  activeFilePath: string | null | undefined;
  activeTabId: string | null;
  attachments: string[];
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
  brainRefreshTrigger,
  ttsEnabled,
  onTtsData,
  onRegisterActions,
}: SessionPaneProps) {
  const [terminal, setTerminal] = useState<XTerminal | null>(null);
  const hasNamedRef = useRef(false);

  // Drag-resize for preview panel and composer — each pane has its own
  const previewMaxRef = useRef<number>(Infinity);
  const preview = useDragResize(PREVIEW_DEFAULT, PREVIEW_MIN, 'right', previewMaxRef);
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

  // Register this pane's actions with App when active
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
    });
  }); // intentionally no deps — re-register on every render so actions stay fresh

  const previewVisible = session.tabs.length > 0;
  previewMaxRef.current = window.innerWidth - TERMINAL_MIN - RESIZE_HANDLE_WIDTH - (previewVisible ? RESIZE_HANDLE_WIDTH : 0);

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Terminal + composer column */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TerminalComponent onReady={handleReady} sendResize={handleSendResize} />
        </div>
        <div
          className="resize-handle--h"
          onMouseDown={composerPanel.onMouseDown}
        />
        <div className="composer-bottom" style={{ height: composerPanel.width }}>
          <AttachBar
            attachments={session.attachments}
            onRemove={session.removeAttachment}
          />
          <div className="composer-area">
            <Composer
              ref={composerRef}
              onSend={handleSendInput}
              disabled={!session.connected}
              attachments={session.attachments}
              clearAttachments={session.clearAttachments}
              onAttach={session.addAttachments}
              cwd={cwd}
            />
          </div>
        </div>
      </div>

      {/* Preview panel column (conditionally shown) */}
      {previewVisible && (
        <>
          <div
            className={`resize-handle${preview.isDragging ? ' dragging' : ''}`}
            onMouseDown={preview.onMouseDown}
          />
          <div className="preview-panel" style={{ width: preview.width }}>
            <EditorTabBar
              tabs={session.tabs}
              activeId={session.activeTabId}
              onSelect={session.setActiveTabId}
              onClose={session.closeTab}
              onPromote={session.promoteTab}
            />
            {(() => {
              const tab = session.tabs.find((t) => t.id === session.activeTabId);
              if (!tab) return null;
              if (tab.tabType === 'brain' && tab.data?.type === 'brain') {
                return (
                  <BrainEntryView
                    data={tab.data as BrainEntryData}
                    cwd={cwd}
                    onClose={() => session.closeTab(tab.id)}
                    onDeleted={() => brainRefreshTrigger?.()}
                    onUpdated={(updated) => session.updateTabData(tab.id, updated)}
                  />
                );
              }
              return (
                <FilePreview
                  data={tab.data}
                  filePath={tab.path}
                  cwd={cwd}
                  initialEditing={session.activeTabId === session.editingTabId}
                  onPromote={() => session.promoteTab(session.activeTabId!)}
                />
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
