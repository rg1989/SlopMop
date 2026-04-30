import { useState, useCallback, useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './hooks/usePty';
import { useFileTree } from './hooks/useFileTree';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useTts } from './hooks/useTts';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import { FileTree } from './components/FileTree';
import { FilePreview } from './components/FilePreview';
import type { FilePreviewData } from './components/FilePreview';
import { EditorTabBar } from './components/EditorTabBar';
import type { EditorTab } from './components/EditorTabBar';
import { AttachBar } from './components/AttachBar';
import { VoiceBar } from './components/VoiceBar';
import './App.css';

const STORAGE_KEY = 'claudetalk_last_folder';
const SIDEBAR_MIN = 140;
const SIDEBAR_DEFAULT = 240;
const PREVIEW_MIN = 180;
const PREVIEW_DEFAULT = 320;
const TERMINAL_MIN = 140;
const RESIZE_HANDLE_WIDTH = 4;

function useDragResize(
  initial: number,
  min: number,
  direction: 'left' | 'right',
  maxRef?: React.RefObject<number>,
) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = direction === 'left'
        ? ev.clientX - startX.current
        : startX.current - ev.clientX;
      const max = maxRef?.current ?? Infinity;
      setWidth(Math.max(min, Math.min(max, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, min, direction, maxRef]);

  return { width, isDragging, onMouseDown };
}

function getInitialPath(): string | null {
  // URL param takes priority — each tab remembers its own folder across refreshes
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

async function fetchFileContent(cwd: string, filePath: string): Promise<FilePreviewData | null> {
  try {
    const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    const res = await fetch(`/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(relPath)}`);
    return await res.json();
  } catch {
    return null;
  }
}

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [initialPath] = useState(getInitialPath);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const sidebarMaxRef = useRef<number>(Infinity);
  const previewMaxRef = useRef<number>(Infinity);

  const sidebar = useDragResize(SIDEBAR_DEFAULT, SIDEBAR_MIN, 'left', sidebarMaxRef);
  const preview = useDragResize(PREVIEW_DEFAULT, PREVIEW_MIN, 'right', previewMaxRef);

  // Keep max refs current every render so drag handlers always see the latest values
  const previewVisible = editorTabs.length > 0;
  sidebarMaxRef.current = window.innerWidth - TERMINAL_MIN - (previewVisible ? preview.width + RESIZE_HANDLE_WIDTH : 0) - RESIZE_HANDLE_WIDTH;
  previewMaxRef.current = window.innerWidth - TERMINAL_MIN - sidebar.width - RESIZE_HANDLE_WIDTH - (previewVisible ? RESIZE_HANDLE_WIDTH : 0);

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const tts = useTts({ enabled: ttsEnabled });

  const { sendInput, sendResize, connected } = usePty({
    cwd,
    terminal,
    cols,
    rows,
    onData: ttsEnabled ? tts.handleData : undefined,
  });

  const voice = useVoiceInput({
    onTranscript: (text) => {
      // TTS-03: transcript from interrupt becomes a new sent message
      sendInput(text + '\r');
    },
    onStart: () => {
      // TTS-04: stop TTS when mic recording starts
      tts.stop();
    },
  });

  const { tree, changedPaths, mode, setMode } = useFileTree(cwd);

  const handleConnect = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, '');
    persistPath(normalized);
    setCwd(normalized);
  }, []);

  const handleReady = useCallback((t: Terminal) => {
    setTerminal(t);
  }, []);

  // Auto-connect when terminal is ready if we have a saved path
  useEffect(() => {
    if (terminal && initialPath && !cwd) {
      handleConnect(initialPath);
    }
  }, [terminal, initialPath, cwd, handleConnect]);

  // Focus Composer when session connects
  useEffect(() => {
    if (connected) composerRef.current?.focus();
  }, [connected]);

  // Clear attachments and tabs when cwd changes
  useEffect(() => {
    setAttachments([]);
    setEditorTabs([]);
    setActiveTabId(null);
    setEditingTabId(null);
  }, [cwd]);

  const openFile = useCallback(async (path: string, isPreview: boolean) => {
    if (!cwd) return;

    if (isPreview) {
      // Replace existing preview tab or push a new one
      setEditorTabs((prev) => {
        const existingPreviewIdx = prev.findIndex((t) => t.isPreview);
        if (existingPreviewIdx !== -1) {
          // Replace the preview tab with new path
          const updated = [...prev];
          updated[existingPreviewIdx] = { id: path, path, isPreview: true, data: null };
          return updated;
        }
        // No preview tab — add one
        return [...prev, { id: path, path, isPreview: true, data: null }];
      });
      setActiveTabId(path);

      // Fetch content and update the tab
      const data = await fetchFileContent(cwd, path);
      setEditorTabs((prev) =>
        prev.map((t) => (t.id === path ? { ...t, data } : t))
      );
    } else {
      // Permanent tab — check if already open
      setEditorTabs((prev) => {
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          // Promote if preview, otherwise just activate
          return prev.map((t) =>
            t.path === path ? { ...t, isPreview: false } : t
          );
        }
        return [...prev, { id: path, path, isPreview: false, data: null }];
      });
      setActiveTabId(path);

      // Fetch content
      const data = await fetchFileContent(cwd, path);
      setEditorTabs((prev) =>
        prev.map((t) => (t.id === path ? { ...t, data } : t))
      );
    }
  }, [cwd]);

  const closeTab = useCallback((id: string) => {
    setEditorTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      // Update active tab: prefer right neighbor, then left, then null
      setActiveTabId((currentActive) => {
        if (currentActive !== id) return currentActive;
        if (next.length === 0) return null;
        const newIdx = Math.min(idx, next.length - 1);
        return next[newIdx].id;
      });
      return next;
    });
    setEditingTabId((prev) => (prev === id ? null : prev));
  }, []);

  const promoteTab = useCallback((id: string) => {
    setEditorTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isPreview: false } : t))
    );
    setEditingTabId(id);
  }, []);

  // Derive the active tab's path for FileTree highlighting
  const activeTab = editorTabs.find((t) => t.id === activeTabId);
  const activeFilePath = activeTab?.path ?? null;

  return (
    <div className="app">
      <div className="folder-bar">
        <FolderPicker initialPath={initialPath ?? undefined} onConnect={handleConnect} />
        {cwd && (
          <span className="active-path" title={cwd}>
            {cwd.replace(/\/$/, '').split('/').pop()}
          </span>
        )}
      </div>
      <div className="app-body">
        {cwd && (
          <>
            <div className="sidebar" style={{ width: sidebar.width }}>
              <div className="sidebar-toolbar">
                <button
                  className={`mode-btn ${mode === 'all' ? 'active' : ''}`}
                  onClick={() => setMode('all')}
                >All</button>
                <button
                  className={`mode-btn ${mode === 'changes' ? 'active' : ''}`}
                  onClick={() => setMode('changes')}
                >Changes</button>
              </div>
              <FileTree
                nodes={tree}
                selected={new Set(attachments)}
                onSelect={(p) => setAttachments(prev => prev.includes(p) ? prev : [...prev, p])}
                onPreview={(p) => openFile(p, true)}
                onOpen={(p) => openFile(p, false)}
                changedPaths={changedPaths}
                mode={mode}
                activePath={activeFilePath ?? undefined}
              />
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
            <TerminalComponent onReady={handleReady} sendResize={sendResize} />
          </div>
          <AttachBar
            attachments={attachments}
            onRemove={(p) => setAttachments(prev => prev.filter(x => x !== p))}
          />
          <div className="composer-area">
            <VoiceBar
              recording={voice.recording}
              speaking={tts.speaking}
              ttsEnabled={ttsEnabled}
              micError={voice.micError}
              onMicStart={voice.start}
              onMicStop={voice.stop}
              onTtsToggle={() => setTtsEnabled(e => !e)}
              onTtsStop={tts.stop}
              supported={voice.supported}
            />
            <Composer
              ref={composerRef}
              onSend={sendInput}
              disabled={!connected}
              attachments={attachments}
              clearAttachments={() => setAttachments([])}
              onAttach={(paths) => setAttachments(prev => [...prev, ...paths.filter(p => !prev.includes(p))])}
              cwd={cwd}
            />
          </div>
        </div>
        {editorTabs.length > 0 && (
          <>
            <div
              className={`resize-handle${preview.isDragging ? ' dragging' : ''}`}
              onMouseDown={preview.onMouseDown}
            />
            <div className="preview-panel" style={{ width: preview.width }}>
              <EditorTabBar
                tabs={editorTabs}
                activeId={activeTabId}
                onSelect={setActiveTabId}
                onClose={closeTab}
                onPromote={promoteTab}
              />
              {(() => {
                const tab = editorTabs.find((t) => t.id === activeTabId);
                if (!tab) return null;
                return (
                  <FilePreview
                    data={tab.data}
                    filePath={tab.path}
                    cwd={cwd}
                    initialEditing={activeTabId === editingTabId}
                    onPromote={() => promoteTab(activeTabId!)}
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
