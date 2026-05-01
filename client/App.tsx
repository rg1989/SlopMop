import { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import type { Terminal } from '@xterm/xterm';
import { useSession } from './hooks/useSession';
import { useFileTree } from './hooks/useFileTree';
import { useAudioCoordinator } from './hooks/useAudioCoordinator';
import { useSettings, matchesPttCombo } from './hooks/useSettings';
import { useDragResize } from './hooks/useDragResize';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import { FileTree } from './components/FileTree';
import { SourceControl } from './components/SourceControl';
import { FilePreview } from './components/FilePreview';
import { EditorTabBar } from './components/EditorTabBar';
import { AttachBar } from './components/AttachBar';
import { VoiceBar } from './components/VoiceBar';
import { SettingsModal } from './components/SettingsModal';
import { GsdRoadmap } from './components/GsdRoadmap';
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
const PREVIEW_MIN = 180;
const PREVIEW_DEFAULT = 320;
const TERMINAL_MIN = 140;
const RESIZE_HANDLE_WIDTH = 4;

// ── Per-cwd UI persistence ────────────────────────────────────────────────────
interface PersistedUIState {
  sidebarWidth: number;
  previewWidth: number;
  tabs: Array<{ path: string; isPreview: boolean }>;
  activeTabId: string | null;
}

function loadUIState(cwd: string): PersistedUIState | null {
  try {
    const raw = localStorage.getItem(`slopdock_ui_${cwd}`);
    return raw ? (JSON.parse(raw) as PersistedUIState) : null;
  } catch { return null; }
}

function saveUIState(cwd: string, state: PersistedUIState) {
  try { localStorage.setItem(`slopdock_ui_${cwd}`, JSON.stringify(state)); } catch {}
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

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── App-scoped state ────────────────────────────────────────────────────────
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [superToolsOpen, setSuperToolsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('explorer');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapseKey, setCollapseKey] = useState(0);

  const [initialPath] = useState(getInitialPath);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { settings, update: updateSettings } = useSettings();

  // Drag-resize — app-scoped because layout is global
  const sidebarMaxRef = useRef<number>(Infinity);
  const previewMaxRef = useRef<number>(Infinity);
  const sidebar = useDragResize(SIDEBAR_DEFAULT, SIDEBAR_MIN, 'left', sidebarMaxRef);
  const preview = useDragResize(PREVIEW_DEFAULT, PREVIEW_MIN, 'right', previewMaxRef);

  // ── Session ─────────────────────────────────────────────────────────────────
  // One session today. When multi-session lands, App maps over an array of these.
  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const audio = useAudioCoordinator({
    ttsEnabled,
    onTranscript: (text) => session.sendInput(text + '\r'),
  });

  const session = useSession({
    cwd,
    terminal,
    cols,
    rows,
    agentConfig: settings.agent,
    onData: ttsEnabled ? audio.tts.handleData : undefined,
  });

  // ── File tree (app-scoped — shared across all future sessions) ───────────────
  const { tree, changedPaths, gitStatus, loadChanges, mode, setMode } = useFileTree(cwd);

  useEffect(() => {
    setMode(sidebarTab === 'changes' ? 'changes' : 'all');
  }, [sidebarTab, setMode]);

  // ── Layout max-width refs (updated every render) ─────────────────────────────
  const previewVisible = session.tabs.length > 0;
  sidebarMaxRef.current = window.innerWidth - TERMINAL_MIN - (previewVisible ? preview.width + RESIZE_HANDLE_WIDTH : 0) - RESIZE_HANDLE_WIDTH;
  previewMaxRef.current = window.innerWidth - TERMINAL_MIN - sidebar.width - RESIZE_HANDLE_WIDTH - (previewVisible ? RESIZE_HANDLE_WIDTH : 0);

  // ── Folder connect ───────────────────────────────────────────────────────────
  const handleConnect = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, '');
    persistPath(normalized);
    setCwd(normalized);
  }, []);

  const handleReady = useCallback((t: Terminal) => setTerminal(t), []);

  // Auto-connect when terminal is ready if we have a saved path
  useEffect(() => {
    if (terminal && initialPath && !cwd) handleConnect(initialPath);
  }, [terminal, initialPath, cwd, handleConnect]);

  // Focus Composer when session connects
  useEffect(() => {
    if (session.connected) composerRef.current?.focus();
  }, [session.connected]);

  // ── UI state restore / persist per cwd ──────────────────────────────────────
  useEffect(() => {
    if (!cwd) return;
    setSidebarSearch('');
    session.clearAttachments();

    const saved = loadUIState(cwd);
    if (saved) {
      sidebar.setWidth(saved.sidebarWidth);
      preview.setWidth(saved.previewWidth);
      session.restoreFromSaved(saved, cwd);
    } else {
      session.resetTabs();
    }
  }, [cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cwd) return;
    const timer = setTimeout(() => {
      saveUIState(cwd, {
        sidebarWidth: sidebar.width,
        previewWidth: preview.width,
        tabs: session.tabs.map(t => ({ path: t.path, isPreview: t.isPreview })),
        activeTabId: session.activeTabId,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [cwd, sidebar.width, preview.width, session.tabs, session.activeTabId]);

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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
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
            session.sendInput('\x15' + command + '\r');
            setSuperToolsOpen(false);
          }}
          onRunWithGsd={async (tool: SuperTool) => {
            await fetch('/api/gsd-track-phase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cwd, name: tool.phaseName, description: tool.phaseDescription }),
            });
            session.sendInput('\x15' + tool.directCommand + '\r');
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
                    selected={new Set(session.attachments)}
                    onPreview={(p) => session.openFile(p, true)}
                    onOpen={(p) => session.openFile(p, false)}
                    onAttach={session.addAttachment}
                    changedPaths={changedPaths}
                    mode={mode}
                    activePath={session.activeFilePath ?? undefined}
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
                    onOpenDiff={session.openDiff}
                  />
                ) : sidebarTab === 'roadmap' ? (
                  <GsdRoadmap cwd={cwd} onOpenFile={session.openFile} />
                ) : (
                  <div className="sidebar-empty-panel">Second Brain — coming soon</div>
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
            onClick={() => composerRef.current?.focus()}
          >
            <TerminalComponent onReady={handleReady} sendResize={session.sendResize} />
          </div>
          <AttachBar
            attachments={session.attachments}
            onRemove={session.removeAttachment}
          />
          <div className="composer-area">
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
            <Composer
              ref={composerRef}
              onSend={session.sendInput}
              disabled={!session.connected}
              attachments={session.attachments}
              clearAttachments={session.clearAttachments}
              onAttach={session.addAttachments}
              cwd={cwd}
            />
          </div>
        </div>

        {session.tabs.length > 0 && (
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
    </div>
  );
}
