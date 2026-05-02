import { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import { useSessionManager } from './hooks/useSessionManager';
import { useFileTree } from './hooks/useFileTree';
import { useAudioCoordinator } from './hooks/useAudioCoordinator';
import { useSettings, matchesPttCombo } from './hooks/useSettings';
import type { AgentConfig } from './hooks/useSettings';
import { useDragResize } from './hooks/useDragResize';
import { FolderPicker } from './components/FolderPicker';
import { VoiceBar } from './components/VoiceBar';
import { FileTree } from './components/FileTree';
import { SourceControl } from './components/SourceControl';
import { SettingsModal } from './components/SettingsModal';
import { GsdRoadmap } from './components/GsdRoadmap';
import { BrainPanel } from './components/BrainPanel';
import { LiveCanvasPanel } from './components/LiveCanvasPanel';
import { SessionTabBar } from './components/SessionTabBar';
import { SessionPane } from './components/SessionPane';
import { SessionHistoryModal } from './components/SessionHistoryModal';
import { EditorTabBar } from './components/EditorTabBar';
import type { EditorTab } from './components/EditorTabBar';
import { FilePreview } from './components/FilePreview';
import type { FilePreviewData } from './components/FilePreview';
import { BrainEntryView } from './components/BrainEntryView';
import type { BrainEntryData } from './components/BrainEntryView';
import { SuperToolsModal } from './components/SuperToolsModal';
import type { SuperTool } from './components/SuperToolsModal';
import { RulesModal } from './components/RulesModal';
import { OnboardingModal } from './components/OnboardingModal';
import { useProjectHealth } from './hooks/useProjectHealth';
import { HealthStatusBar } from './components/HealthStatusBar';
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
const STORAGE_KEY = 'slopmop_last_folder';
const SIDEBAR_MIN = 180;
const SIDEBAR_DEFAULT = 240;
const RESIZE_HANDLE_WIDTH = 4;
const CANVAS_DEFAULT_WIDTH = 360;
const CANVAS_MIN = 200;
const CANVAS_MIN_CENTER = 280;

// ── UI state persistence ──────────────────────────────────────────────────────
const UI = {
  sidebarTab:    'slopmop_ui:sidebar_tab',
  sidebarWidth:  'slopmop_ui:sidebar_width',
  editorWidth:   'slopmop_ui:editor_width',
  editorTabs:    (cwd: string) => `slopmop_ui:editor_tabs:${cwd}`,
  canvasVisible: 'slopmop_ui:canvas_visible',
  canvasWidth:   'slopmop_ui:canvas_width',
} as const;

function uiRead<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function uiWrite(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

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
  tabs: EditorTab[];
  editingTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  closeTab: (id: string) => void;
  promoteTab: (id: string) => void;
  updateTabData: (id: string, data: FilePreviewData) => void;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── App-scoped state ────────────────────────────────────────────────────────
  const [cwd, setCwd] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [superToolsOpen, setSuperToolsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sidebarTab, setSidebarTabRaw] = useState<SidebarTabId>(() => {
    const saved = uiRead<string>(UI.sidebarTab, 'explorer');
    const valid: SidebarTabId[] = ['explorer', 'changes', 'roadmap', 'brain'];
    return valid.includes(saved as SidebarTabId) ? (saved as SidebarTabId) : 'explorer';
  });
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
  // Editor panel state (hoisted from SessionPane)
  const [activeTabs, setActiveTabs] = useState<EditorTab[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string | null>(null);
  const [activeEditingTabId, setActiveEditingTabId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [slopExists, setSlopExists] = useState<boolean | null>(null);

  const { settings, update: updateSettings } = useSettings();
  const health = useProjectHealth(cwd, settings.agent.command);

  // Drag-resize — restore persisted widths as initial values
  const sidebarMaxRef = useRef<number>(Infinity);
  const [sidebarInitWidth] = useState(() => Math.max(SIDEBAR_MIN, uiRead(UI.sidebarWidth, SIDEBAR_DEFAULT)));
  const sidebar = useDragResize(sidebarInitWidth, SIDEBAR_MIN, 'left', sidebarMaxRef);
  const editorMaxRef = useRef<number>(Infinity);
  const [editorInitWidth] = useState(() => Math.max(180, uiRead(UI.editorWidth, 320)));
  const editor = useDragResize(editorInitWidth, 180, 'right', editorMaxRef);
  const [isCanvasVisible, setIsCanvasVisible] = useState<boolean>(() =>
    uiRead<boolean>(UI.canvasVisible, true)
  );
  const [canvasInitWidth] = useState(() => {
    const stored = uiRead(UI.canvasWidth, CANVAS_DEFAULT_WIDTH);
    const max = Math.floor(window.innerWidth * 0.7);
    return Math.max(CANVAS_MIN, Math.min(max, stored));
  });
  const canvasMaxRef = useRef<number>(Infinity);
  const canvas = useDragResize(canvasInitWidth, CANVAS_MIN, 'right', canvasMaxRef);

  // Track drag-end to persist widths (avoid writing on every pixel during drag)
  const prevSidebarDragging = useRef(false);
  const prevEditorDragging = useRef(false);
  const prevCanvasDragging = useRef(false);
  useEffect(() => {
    if (prevSidebarDragging.current && !sidebar.isDragging) uiWrite(UI.sidebarWidth, sidebar.width);
    prevSidebarDragging.current = sidebar.isDragging;
  }, [sidebar.isDragging, sidebar.width]);
  useEffect(() => {
    if (prevEditorDragging.current && !editor.isDragging) uiWrite(UI.editorWidth, editor.width);
    prevEditorDragging.current = editor.isDragging;
  }, [editor.isDragging, editor.width]);
  useEffect(() => {
    if (prevCanvasDragging.current && !canvas.isDragging) uiWrite(UI.canvasWidth, canvas.width);
    prevCanvasDragging.current = canvas.isDragging;
  }, [canvas.isDragging, canvas.width]);

  const toggleCanvas = useCallback(() => {
    setIsCanvasVisible(v => {
      uiWrite(UI.canvasVisible, !v);
      return !v;
    });
  }, []);

  // Ref used to restore editor tabs exactly once per cwd
  const initialSessionRestoredRef = useRef(false);

  // ── Session manager ──────────────────────────────────────────────────────────
  const sessionManager = useSessionManager();

  // ── Audio coordinator (app-scoped — routes to active session via ref) ────────
  const audio = useAudioCoordinator({
    ttsEnabled,
    onTranscript: (text) => activeActionsRef.current?.sendInput(text + '\r'),
  });

  // ── File tree (app-scoped — shared across all sessions) ──────────────────────
  const { tree, changedPaths, gitStatus, loadChanges, mode, setMode } = useFileTree(cwd);

  const setSidebarTab = useCallback((tab: SidebarTabId) => {
    setSidebarTabRaw(tab);
    uiWrite(UI.sidebarTab, tab);
  }, []);

  // Persist editor tabs whenever the active session's tabs change
  useEffect(() => {
    if (!cwd) return;
    uiWrite(UI.editorTabs(cwd), {
      tabs: activeTabs.map(t => ({ path: t.path, isPreview: t.isPreview })),
      activeTabId: activeEditorTabId,
    });
  }, [activeTabs, activeEditorTabId, cwd]);

  // Reset restore flag when project changes so new project gets its own tabs
  useEffect(() => {
    initialSessionRestoredRef.current = false;
  }, [cwd]);

  useEffect(() => {
    setMode(sidebarTab === 'changes' ? 'changes' : 'all');
  }, [sidebarTab, setMode]);

  useEffect(() => {
    if (!cwd) { setSlopExists(null); return; }
    fetch(`/api/slop-status?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ exists, config }: { exists: boolean; config: { agent?: AgentConfig } | null }) => {
        setSlopExists(exists);
        if (config?.agent) updateSettings({ agent: config.agent });
      })
      .catch(() => setSlopExists(null));
  }, [cwd]);

  // ── Layout max-width refs (updated every render) ─────────────────────────────
  sidebarMaxRef.current = window.innerWidth - 300 - RESIZE_HANDLE_WIDTH;
  editorMaxRef.current = window.innerWidth - (cwd ? sidebar.width + RESIZE_HANDLE_WIDTH : 0) - 300;
  {
    const currentSidebarWidth = cwd ? sidebar.width + RESIZE_HANDLE_WIDTH : 0;
    canvasMaxRef.current = window.innerWidth - currentSidebarWidth - CANVAS_MIN_CENTER - RESIZE_HANDLE_WIDTH;
  }

  // Guard against React StrictMode double-invoking the initial spawn effect
  const initialSpawnedRef = useRef(false);

  // ── Folder connect ───────────────────────────────────────────────────────────
  const handleConnect = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, '');
    persistPath(normalized);
    setCwd(normalized);
    sessionManager.restoreForCwd(normalized);
    sessionManager.spawn(normalized, { initial: true });
  }, [sessionManager]);

  // Auto-connect from saved path on first load — validates the path still exists first
  useEffect(() => {
    if (!initialPath || initialSpawnedRef.current) return;
    initialSpawnedRef.current = true;
    const normalized = initialPath.replace(/\/+$/, '');
    fetch(`/api/dir-exists?path=${encodeURIComponent(normalized)}`)
      .then(r => r.json())
      .then(({ exists }: { exists: boolean }) => {
        if (!exists) {
          localStorage.removeItem(STORAGE_KEY);
          const url = new URL(window.location.href);
          url.searchParams.delete('cwd');
          window.history.replaceState(null, '', url.toString());
          return;
        }
        persistPath(normalized);
        setCwd(normalized);
        sessionManager.restoreForCwd(normalized);
        sessionManager.spawn(normalized, { initial: true });
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
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
      {cwd && slopExists === false && (
        <OnboardingModal
          cwd={cwd}
          onInit={() => setSlopExists(true)}
        />
      )}

      <div className="folder-bar">
        <FolderPicker
          cwd={cwd}
          onConnect={handleConnect}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSuperToolsOpen={() => setSuperToolsOpen(true)}
          onRulesOpen={() => setRulesOpen(true)}
          onCanvasToggle={toggleCanvas}
          isCanvasVisible={isCanvasVisible}
        />
      </div>
      {cwd && <HealthStatusBar health={health} slopExists={slopExists} />}

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
          cwd={cwd}
        />
      )}

      {rulesOpen && (
        <RulesModal
          cwd={cwd}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {historyOpen && (
        <SessionHistoryModal
          cwd={cwd ?? ''}
          history={sessionManager.history}
          onOpen={(entry) => sessionManager.spawn(entry.cwd)}
          onClose={() => setHistoryOpen(false)}
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
                    onAttach={handleSidebarAttach}
                  />
                ) : sidebarTab === 'roadmap' ? (
                  <GsdRoadmap
                    cwd={cwd}
                    onOpenFile={handleSidebarOpen}
                    activeFilePath={activeFilePath}
                    onSendCommand={(cmd) => activeActionsRef.current?.sendInput('\x15' + cmd + '\r')}
                  />
                ) : (
                  <BrainPanel
                    cwd={cwd}
                    onOpenEntry={handleSidebarBrainEntry}
                    onAttach={handleSidebarAttach}
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
              canSpawn={
                sessionManager.sessions.length > 1
                  ? !sessionManager.sessions.some(s => s.name === 'New')
                  : sessionManager.hasPrompted
              }
              onSetActive={sessionManager.setActive}
              onClose={sessionManager.close}
              onSpawn={() => { if (cwd) sessionManager.spawn(cwd); }}
              onOpenHistory={() => setHistoryOpen(true)}
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
                voiceSlot={s.id === sessionManager.activeId ? (
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
                    compact
                  />
                ) : undefined}
                ttsEnabled={ttsEnabled}
                onTtsData={audio.tts.handleData}
                brainRefreshTrigger={() => setBrainRefreshKey(k => k + 1)}
                onRegisterActions={(actions) => {
                  if (s.id === sessionManager.activeId) {
                    activeActionsRef.current = actions;
                    setActiveFilePath(actions.activeFilePath ?? undefined);
                    setActiveAttachments(actions.attachments);
                    setActiveBrainTabId(actions.activeTabId);
                    setActiveTabs(actions.tabs);
                    setActiveEditorTabId(actions.activeTabId);
                    setActiveEditingTabId(actions.editingTabId);

                    if (!initialSessionRestoredRef.current && cwd) {
                      initialSessionRestoredRef.current = true;
                      const saved = uiRead<{ tabs: Array<{ path: string; isPreview: boolean }>; activeTabId: string | null } | null>(UI.editorTabs(cwd), null);
                      if (saved && saved.tabs.length > 0) {
                        actions.restoreFromSaved(saved, cwd);
                      }
                    }
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Editor panel — right column, full height, shown when tabs are open */}
        {activeTabs.length > 0 && (
          <>
            <div
              className={`resize-handle${editor.isDragging ? ' dragging' : ''}`}
              onMouseDown={editor.onMouseDown}
            />
            <div className="editor-panel" style={{ width: editor.width }}>
              <EditorTabBar
                tabs={activeTabs}
                activeId={activeEditorTabId}
                onSelect={(id) => activeActionsRef.current?.setActiveTabId(id)}
                onClose={(id) => activeActionsRef.current?.closeTab(id)}
                onPromote={(id) => activeActionsRef.current?.promoteTab(id)}
              />
              {(() => {
                const tab = activeTabs.find((t) => t.id === activeEditorTabId);
                if (!tab) return null;
                if (tab.tabType === 'brain' && tab.data?.type === 'brain') {
                  return (
                    <BrainEntryView
                      data={tab.data as BrainEntryData}
                      cwd={cwd!}
                      onClose={() => activeActionsRef.current?.closeTab(tab.id)}
                      onDeleted={() => setBrainRefreshKey(k => k + 1)}
                      onUpdated={(updated) => activeActionsRef.current?.updateTabData(tab.id, updated)}
                    />
                  );
                }
                return (
                  <FilePreview
                    data={tab.data}
                    filePath={tab.path}
                    cwd={cwd!}
                    initialEditing={activeEditorTabId === activeEditingTabId}
                    onPromote={() => activeActionsRef.current?.promoteTab(activeEditorTabId!)}
                  />
                );
              })()}
            </div>
          </>
        )}

        {/* Canvas column — persistent right panel, shown when cwd is set and canvas is visible */}
        {cwd && isCanvasVisible && (
          <>
            <div
              className={`resize-handle${canvas.isDragging ? ' dragging' : ''}`}
              onMouseDown={canvas.onMouseDown}
            />
            <div className="canvas-column" style={{ width: canvas.width }}>
              <div className="canvas-column-header">
                <span className="canvas-column-label">Canvas</span>
                <button
                  className="canvas-toggle-btn"
                  title="Hide canvas"
                  onClick={toggleCanvas}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <LiveCanvasPanel cwd={cwd} isDragging={canvas.isDragging} />
            </div>
          </>
        )}
      </div>
      <footer className="app-footer">
        developed by{' '}
        <a href="https://github.com/rg1989" target="_blank" rel="noreferrer">
          rg1989
        </a>
      </footer>
    </div>
  );
}
