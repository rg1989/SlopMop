import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import { useSession } from '../hooks/useSession';
import type { SessionStatus } from '../hooks/useSessionManager';
import type { AgentConfig } from '../hooks/useSettings';
import { Terminal as TerminalComponent } from './Terminal';
import { TerminalInput } from './TerminalInput';
import type { TerminalInputHandle } from './TerminalInput';
import SlashMenu, { SLASH_COMMANDS } from './SlashMenu';
import type { SlashCommand } from './SlashMenu';
import type { EditorTab } from './EditorTabBar';
import type { FilePreviewData } from './FilePreview';
import { ActionBar } from './ActionBar';

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
  restoreFromSaved: (saved: { tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null }, cwd: string) => void;
}

interface SessionPaneProps {
  sessionId: string;
  cwd: string;
  agentConfig: AgentConfig;
  isActive: boolean;
  onStatus: (status: SessionStatus) => void;
  onExit: (code: number) => void;
  onFirstInput: (sessionId: string, text: string) => void;
  composerRef?: React.RefObject<TerminalInputHandle | null>;
  voiceSlot?: ReactNode;
  brainRefreshTrigger?: () => void;
  ttsEnabled?: boolean;
  onTtsData?: (raw: string) => void;
  /** Called when active — lets App route sidebar and audio actions to this pane */
  onRegisterActions?: (actions: SessionPaneActions) => void;
  accentHex?: string;
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
  accentHex,
}: SessionPaneProps) {
  const [terminal, setTerminal] = useState<XTerminal | null>(null);
  const hasNamedRef = useRef(false);
  const [visibleKey, setVisibleKey] = useState(0);
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current) setVisibleKey(k => k + 1);
    wasActiveRef.current = isActive;
  }, [isActive]);

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

  const localInputRef = useRef<TerminalInputHandle | null>(null);
  const inputRef = composerRef ?? localInputRef;
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const [picking, setPicking] = useState(false);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashItems = SLASH_COMMANDS;

  const handleSlashOpen = useCallback(() => { setSlashOpen(true); setSlashIndex(0); }, []);
  const handleSlashClose = useCallback(() => setSlashOpen(false), []);
  const handleSlashNavigate = useCallback((dir: 1 | -1) => {
    setSlashIndex(i => {
      const next = i + dir;
      if (next < 0) return slashItems.length - 1;
      if (next >= slashItems.length) return 0;
      return next;
    });
  }, [slashItems.length]);
  const handleSlashSelect = useCallback((cmd?: SlashCommand) => {
    const selected = cmd ?? slashItems[slashIndex];
    if (!selected) return;
    inputRef.current?.injectText?.(selected.command + ' ');
    setSlashOpen(false);
  }, [slashItems, slashIndex, inputRef]);

  const handleReady = useCallback((t: XTerminal) => setTerminal(t), []);

  const handlePickFile = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    try {
      const res = await fetch('/api/pick-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd }),
      });
      if (res.ok) {
        const { paths } = await res.json() as { paths: string[] };
        if (paths.length > 0) session.addAttachments(paths);
      }
    } finally {
      setPicking(false);
    }
  }, [picking, cwd, session]);

  // Focus the input strip whenever this pane becomes active
  useEffect(() => {
    if (isActive) inputRef.current?.focus();
  }, [isActive, inputRef]);

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
      restoreFromSaved: session.restoreFromSaved,
    });
  }); // intentionally no deps — re-register on every render so actions stay fresh

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }} onClick={() => inputRef.current?.focus()}>
          <TerminalComponent onReady={handleReady} sendResize={handleSendResize} visibleKey={visibleKey} accentHex={accentHex} disableStdin={true} />
        </div>
        <div className="terminal-input-wrapper" ref={inputWrapperRef}>
          <ActionBar
            voiceSlot={voiceSlot}
            onAttach={handlePickFile}
            picking={picking}
          />
          <TerminalInput
            ref={inputRef}
            sendInput={handleSendInput}
            connected={session.connected}
            accentHex={accentHex}
            onSlashOpen={handleSlashOpen}
            onSlashClose={handleSlashClose}
            onSlashNavigate={handleSlashNavigate}
            onSlashSelect={handleSlashSelect}
          />
          {slashOpen && slashItems.length > 0 && (
            <SlashMenu
              items={slashItems}
              selectedIndex={slashIndex}
              onSelect={handleSlashSelect}
              onClose={handleSlashClose}
              anchorRect={inputWrapperRef.current?.getBoundingClientRect() ?? new DOMRect()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
