import { useState, useCallback, useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './hooks/usePty';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import './App.css';

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const cols = terminal?.cols ?? 80;
  const rows = terminal?.rows ?? 24;

  const { sendInput, sendResize, connected } = usePty({
    cwd,
    terminal,
    cols,
    rows,
  });

  const handleReady = useCallback((t: Terminal) => {
    setTerminal(t);
  }, []);

  // Auto-focus Composer when session connects
  useEffect(() => {
    if (connected) composerRef.current?.focus();
  }, [connected]);

  return (
    <div className="app">
      <div className="folder-bar">
        <FolderPicker onConnect={(path) => setCwd(path)} />
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
        <Composer ref={composerRef} onSend={sendInput} disabled={!cwd || !terminal} />
      </div>
    </div>
  );
}
