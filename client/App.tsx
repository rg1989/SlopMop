import { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import { useSessionManager } from './hooks/useSessionManager';
import { useFileTree } from './hooks/useFileTree';
import { useAudioCoordinator } from './hooks/useAudioCoordinator';
import { useSettings, matchesPttCombo } from './hooks/useSettings';
import { useDragResize } from './hooks/useDragResize';
import { FolderPicker } from './components/FolderPicker';
import { VoiceBar } from './components/VoiceBar';
import { FileTree } from './components/FileTree';
import { SourceControl } from './components/SourceControl';
import { SettingsModal } from './components/SettingsModal';
import { GsdRoadmap } from './components/GsdRoadmap';
import { BrainPanel } from './components/BrainPanel';
import { SessionTabBar } from './components/SessionTabBar';
import { SessionPane } from './components/SessionPane';
import { SuperToolsModal } from './components/SuperToolsModal';
import type { SuperTool } from './components/SuperToolsModal';
import './App.css';

type SidebarTabId = 'explorer' | 'changes' | 'roadmap' | 'brain';

const IconExplorer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconChanges = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
    <path d="M6 21V9a9 9 0 0 0 9 9"/>
  </svg>
);
const IconRoadmap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);
const IconBrain = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3z"/>
  </svg>
);

const SIDEBAR_TABS: { id: SidebarTabId; label: string; Icon: () => JSX.Element }[] = [
  { id: 'explorer', label: 'Explorer', Icon: IconExplorer },
  { id: 'changes', label: 'Source Control', Icon: IconChanges },
  { id: 'roadmap', label: 'GSD Roadmap', Icon: IconRoadmap },
  { id: 'brain', label: 'Second Brain', Icon: IconBrain },
];

// ── Layout constants ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'slopdock_last_folder';
const SIDEBAR_MIN = 140;
const SIDEBAR_DEFAULT = 240;
const RESIZE_HANDLE_WIDTH = 4;

// ── Path persistence ──────────────────────────────────────────────────────────
function getInitialPath(): string | null {
  const params = new URLSearchParams(window.location.search);
  const urlPath = params.get('cwd');
  if (urlPath) return urlPath;
  return localStorage.getItem(STORAGE_KEY);
}

function persistPath(cwd: string) {
  localStorage.setItem(STORAGE_KEY, cwd);
  const url = new URL(window.location.href);
  url.searchParams.set('cwd', cwd);
  window.history.replaceState(null, '', url.toString());
}

// ── Active session actions ref type ──────────────────────────────────────────
interface ActiveSessionActions {
  sendInput: (data: string) => void;
  openFile: (path: string, isPreview: boolean) => void;
  openDiff: (path: string, staged: boolean) => void;
  addAttachment: (path: string) => void;
  openBrainEntry: (id: string, isPreview: boolean) => void;
  activeFilePath: string | null | undefined;
  activeTabId: string | null;
  attachments: string[];
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── App-scoped state ────────────────────────────────────────────────────────
  const [cwd, setCwd] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [superToolsOpen, setSuperToolsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('explorer');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapseKey, setCollapseKey] = useState(0);
  const [brainRefreshKey, setBrainRefreshKey] = useState(0);

  const [initialPath] = useState(getInitialPath);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Active session actions — populated by the active SessionPane
  const activeActionsRef = useRef<ActiveSessionActions | null>(null);
  // Track active session actions state for re-render (sidebar highlights)
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>(undefined);
  const [activeAttachments, setActiveAttachments] = useState<string[]>([]);
  const [activeBrainTabId, setActiveBrainTabId] = useState<string | null>(null);

  const { settings, update: updateSettings } = useSettings();

  // Drag-resize — sidebar only (app-scoped because layout is global)
  const sidebarMaxRef = useRef<number>(Infinity);
  const sidebar = useDragResize(SIDEBAR_DEFAULT, SIDEBAR_MIN, 'left', sidebarMaxRef);

  // ── Session manager ──────────────────────────────────────────────────────────
  const sessionManager = useSessionManager();

  // ── Audio coordinator (app-scoped — routes to active session via ref) ────────
  const audio = useAudioCoordinator({
    ttsEnabled,
    onTranscript: (text) => activeActionsRef.current?.sendInput(text + '\r'),
  });

  // ── File tree (app-scoped — shared across all sessions) ──────────────────────
  const { tree, changedPaths, gitStatus, loadChanges, mode, setMode } = useFileTree(cwd);

  useEffect(() => {
    setMode(sidebarTab === 'changes' ? 'changes' : 'all');
  }, [sidebarTab, setMode]);

  // ── Layout max-width refs (updated every render) ─────────────────────────────
  sidebarMaxRef.current = window.innerWidth - 300 - RESIZE_HANDLE_WIDTH;

  // ── Folder connect ───────────────────────────────────────────────────────────
  const handleConnect = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, '');
    persistPath(normalized);
    setCwd(normalized);
    sessionManager.spawn(normalized);
  }, [sessionManager]);

  // Auto-connect from saved path on first load
  useEffect(() => {
    if (initialPath) {
      const normalized = initialPath.replace(/\/+$/, '');
      persistPath(normalized);
      setCwd(normalized);
      sessionManager.spawn(normalized);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push-to-talk ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings.pttKey) return;
    const combo = settings.pttKey;
    const onDown = (e: KeyboardEvent) => {
      if (!matchesPttCombo(e, combo)) return;
      if (e.repeat) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (settings.recordingMode === 'hold') {
        audio.voice.start();
      } else {
        if (audio.voice.recording) audio.voice.stop(); else audio.voice.start();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== combo.code) return;
      if (settings.recordingMode === 'hold') audio.voice.stop();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [settings.pttKey, settings.recordingMode, audio.voice]);

  // ── Sidebar routing — resolved from active session via ref ───────────────────
  const handleSidebarPreview = useCallback((p: string) => activeActionsRef.current?.openFile(p, true), []);
  const handleSidebarOpen = useCallback((p: string) => activeActionsRef.current?.openFile(p, false), []);
  const handleSidebarAttach = useCallback((p: string) => activeActionsRef.current?.addAttachment(p), []);
  const handleSidebarDiff = useCallback((p: string, staged: boolean) => activeActionsRef.current?.openDiff(p, staged), []);
  const handleSidebarBrainEntry = useCallback((id: string, isPreview: boolean) => activeActionsRef.current?.openBrainEntry(id, isPreview), []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="app"
      style={settings.typeIndicatorSize === 'none'
        ? { '--type-indicator-size': '0px', '--type-indicator-display': 'none' } as React.CSSProperties
        : { '--type-indicator-size': `${settings.typeIndicatorSize}px`, '--type-indicator-display': 'inline-flex' } as React.CSSProperties
      }
    >
      <div className="folder-bar">
        <FolderPicker
          cwd={cwd}
          onConnect={handleConnect}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSuperToolsOpen={() => setSuperToolsOpen(true)}
        />
      </div>

      {superToolsOpen && (
        <SuperToolsModal
          cwd={cwd}
          onClose={() => setSuperToolsOpen(false)}
          onRunDirect={(command) => {
            activeActionsRef.current?.sendInput('\x15' + command + '\r');
            setSuperToolsOpen(false);
          }}
          onRunWithGsd={async (tool: SuperTool) => {
            await fetch('/api/gsd-track-phase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cwd, name: tool.phaseName, description: tool.phaseDescription }),
            });
            activeActionsRef.current?.sendInput('\x15' + tool.directCommand + '\r');
            setSuperToolsOpen(false);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <div className="app-body">
        {cwd && (
          <>
            <div
              className={`sidebar${settings.sidebarTabsOrientation === 'vertical' ? ' sidebar--vertical' : ''}`}
              style={{ width: sidebar.width }}
            >
              <div className={`sidebar-tabs-bar sidebar-tabs-bar--${settings.sidebarTabsOrientation === 'vertical' ? 'v' : 'h'}`}>
                {SIDEBAR_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`stab${sidebarTab === id ? ' stab--active' : ''}`}
                    title={label}
                    onClick={() => setSidebarTab(id)}
                  >
                    <Icon />
                  </button>
                ))}
              </div>
              <div className="sidebar-content-area">
                {sidebarTab === 'explorer' && (
                  <div className="sidebar-search-bar">
                    <input
                      className="sidebar-search-input"
                      type="text"
                      placeholder="Search files…"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                    />
                    <button
                      className="sidebar-collapse-btn"
                      title="Collapse all"
                      onClick={() => setCollapseKey((k) => k + 1)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                        <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
                      </svg>
                    </button>
                  </div>
                )}
                {sidebarTab === 'explorer' ? (
                  <FileTree
                    nodes={tree}
                    selected={new Set(activeAttachments)}
                    onPreview={handleSidebarPreview}
                    onOpen={handleSidebarOpen}
                    onAttach={handleSidebarAttach}
                    changedPaths={changedPaths}
                    mode={mode}
                    activePath={activeFilePath}
                    collapseKey={collapseKey}
                    searchQuery={sidebarSearch}
                    showHiddenFiles={settings.showHiddenFiles}
                    cwd={cwd ?? undefined}
                    onRefresh={loadChanges}
                  />
                ) : sidebarTab === 'changes' ? (
                  <SourceControl
                    cwd={cwd}
                    gitStatus={gitStatus}
                    onRefresh={loadChanges}
                    onOpenDiff={handleSidebarDiff}
                  />
                ) : sidebarTab === 'roadmap' ? (
                  <GsdRoadmap cwd={cwd} onOpenFile={handleSidebarOpen} activeFilePath={activeFilePath} />
                ) : (
                  <BrainPanel
                    cwd={cwd}
                    onOpenEntry={handleSidebarBrainEntry}
                    refreshKey={brainRefreshKey}
                    activeEntryId={activeBrainTabId?.startsWith('brain:') ? activeBrainTabId.slice(6) : undefined}
                  />
                )}
              </div>
            </div>
            <div
              className={`resize-handle${sidebar.isDragging ? ' dragging' : ''}`}
              onMouseDown={sidebar.onMouseDown}
            />
          </>
        )}

        <div className="main-area">
          <div
            className="terminal-area"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={() => composerRef.current?.focus()}
          >
            <SessionTabBar
              sessions={sessionManager.sessions}
              activeId={sessionManager.activeId}
              onSetActive={sessionManager.setActive}
              onClose={sessionManager.close}
              onSpawn={() => { if (cwd) sessionManager.spawn(cwd); }}
            />
            {sessionManager.sessions.map(s => (
              <SessionPane
                key={s.id}
                sessionId={s.id}
                cwd={s.cwd}
                agentConfig={settings.agent}
                isActive={s.id === sessionManager.activeId}
                onStatus={(status) => sessionManager.updateStatus(s.id, status)}
                onExit={(code) => sessionManager.updateStatus(s.id, code === 0 ? 'done' : 'error')}
                onFirstInput={(_id, text) => sessionManager.updateName(s.id, text)}
                composerRef={s.id === sessionManager.activeId ? composerRef : undefined}
                ttsEnabled={ttsEnabled}
                onTtsData={audio.tts.handleData}
                brainRefreshTrigger={() => setBrainRefreshKey(k => k + 1)}
                onRegisterActions={(actions) => {
                  if (s.id === sessionManager.activeId) {
                    activeActionsRef.current = actions;
                    setActiveFilePath(actions.activeFilePath ?? undefined);
                    setActiveAttachments(actions.attachments);
                    setActiveBrainTabId(actions.activeTabId);
                  }
                }}
              />
            ))}
          </div>

          <div className="voice-bar-row">
            <VoiceBar
              recording={audio.voice.recording}
              transcribing={audio.voice.transcribing}
              speaking={audio.tts.speaking}
              ttsEnabled={ttsEnabled}
              micError={audio.voice.micError}
              onMicStart={audio.voice.start}
              onMicStop={audio.voice.stop}
              onTtsToggle={() => setTtsEnabled(e => !e)}
              onTtsStop={audio.tts.stop}
              supported={audio.voice.supported}
              ttsAvailable={audio.tts.piperAvailable}
              whisperAvailable={audio.voice.whisperAvailable}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
