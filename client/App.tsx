import { useState, useCallback, useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './hooks/usePty';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import './App.css';

const STORAGE_KEY = 'claudetalk_last_folder';

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

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const { sendInput, sendResize, connected } = usePty({
    cwd,
    terminal,
    cols,
    rows,
  });

  const handleConnect = useCallback((path: string) => {
    persistPath(path);
    setCwd(path);
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

  return (
    <div className="app">
      <div className="folder-bar">
        <FolderPicker initialPath={initialPath ?? undefined} onConnect={handleConnect} />
        <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div
        className="terminal-area"
        onClick={() => composerRef.current?.focus()}
      >
        <TerminalComponent onReady={handleReady} sendResize={sendResize} />
      </div>
      <div className="composer-area">
        <Composer ref={composerRef} onSend={sendInput} disabled={!connected} />
      </div>
    </div>
  );
}
