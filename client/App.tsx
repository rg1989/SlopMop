import { useState, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';
import { usePty } from './hooks/usePty';
import { Terminal as TerminalComponent } from './components/Terminal';
import { FolderPicker } from './components/FolderPicker';
import { Composer } from './components/Composer';
import './App.css';

export default function App() {
  const [cwd, setCwd] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);

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

  return (
    <div className="app">
      <div className="folder-bar">
        <FolderPicker onConnect={(path) => setCwd(path)} />
        <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="terminal-area">
        <TerminalComponent onReady={handleReady} sendResize={sendResize} />
      </div>
      <div className="composer-area">
        <Composer onSend={sendInput} disabled={!cwd || !terminal} />
      </div>
    </div>
  );
}
