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

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [initialPath] = useState(getInitialPath);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const sidebarMaxRef = useRef<number>(Infinity);
  const previewMaxRef = useRef<number>(Infinity);

  const sidebar = useDragResize(SIDEBAR_DEFAULT, SIDEBAR_MIN, 'left', sidebarMaxRef);
  const preview = useDragResize(PREVIEW_DEFAULT, PREVIEW_MIN, 'right', previewMaxRef);

  // Keep max refs current every render so drag handlers always see the latest values
  const previewVisible = previewPath !== null;
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

  // Clear attachments and preview when cwd changes
  useEffect(() => {
    setAttachments([]);
    setPreviewPath(null);
    setPreviewData(null);
  }, [cwd]);

  // Fetch file content when previewPath changes
  useEffect(() => {
    if (!previewPath || !cwd) { setPreviewData(null); return; }
    const relPath = previewPath.startsWith(cwd) ? previewPath.slice(cwd.length + 1) : previewPath;
    fetch(`/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(relPath)}`)
      .then(r => r.json())
      .then(setPreviewData)
      .catch(() => setPreviewData(null));
  }, [previewPath, cwd]);

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
                onPreview={setPreviewPath}
                changedPaths={changedPaths}
                mode={mode}
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
        {previewPath && (
          <>
          <div
            className={`resize-handle${preview.isDragging ? ' dragging' : ''}`}
            onMouseDown={preview.onMouseDown}
          />
          <div className="preview-panel" style={{ width: preview.width }}>
            <div className="preview-panel-header">
              <span className="preview-filename">{previewPath.split('/').pop()}</span>
              <button className="preview-close" onClick={() => { setPreviewPath(null); setPreviewData(null); }}>&times;</button>
            </div>
            <FilePreview data={previewData} filePath={previewPath} cwd={cwd} />
          </div>
          </>
        )}
      </div>
    </div>
  );
}
