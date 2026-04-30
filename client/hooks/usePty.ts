import { useEffect, useRef, useCallback, useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';

interface UsePtyOptions {
  cwd: string | null;
  terminal: Terminal | null;
  cols: number;
  rows: number;
}

interface UsePtyReturn {
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  connected: boolean;
}

export function usePty({ cwd, terminal, cols, rows }: UsePtyOptions): UsePtyReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!cwd || !terminal) return;

    const ws = new WebSocket('ws://localhost:3000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      send({ type: 'start', cwd, cols, rows });
      terminal.focus();
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'data') terminal.write(msg.data);
      if (msg.type === 'error') console.error('PTY error:', msg.message);
      if (msg.type === 'exit') {
        setConnected(false);
        console.info('PTY exited with code:', msg.code);
      }
    };

    ws.onerror = (err) => console.error('WebSocket error', err);

    ws.onclose = () => setConnected(false);

    // Route keystrokes typed in the terminal directly to the PTY
    const inputDisposable = terminal.onData((data) => send({ type: 'input', data }));

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
      inputDisposable.dispose();
    };
  }, [cwd, terminal]); // cols/rows intentionally excluded — resize handled separately

  const sendInput = useCallback((data: string) => send({ type: 'input', data }), [send]);
  const sendResize = useCallback((c: number, r: number) => send({ type: 'resize', cols: c, rows: r }), [send]);

  return { sendInput, sendResize, connected };
}
