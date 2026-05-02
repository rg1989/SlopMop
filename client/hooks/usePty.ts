import { useEffect, useRef, useCallback, useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import type { AgentConfig } from './useSettings';

export type SessionStatus = 'connecting' | 'reconnecting' | 'waiting' | 'working' | 'done' | 'error';

export interface UsePtyOptions {
  cwd: string | null;
  terminal: Terminal | null;
  cols: number;
  rows: number;
  agentConfig: AgentConfig;
  onData?: (raw: string) => void;
  /** Stable UUID — passed from useSessionManager; falls back to crypto.randomUUID() */
  sessionId?: string;
  /** Called whenever session status changes */
  onStatus?: (status: SessionStatus) => void;
  /** Called when PTY exits, with exit code */
  onExit?: (code: number) => void;
  /** Override WebSocket URL — defaults to ws[s]://<same-host>/ws */
  wsUrl?: string;
}

export interface UsePtyReturn {
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  connected: boolean;
}

function deriveWsUrl(override?: string): string {
  if (override) return override;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function usePty({ cwd, terminal, cols, rows, agentConfig, onData, sessionId, onStatus, onExit, wsUrl }: UsePtyOptions): UsePtyReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  // When PTY exits we want a fresh session, not a replay of the exited one
  const overrideSessionIdRef = useRef<string | null>(null);
  const onDataRef = useRef(onData);
  const onStatusRef = useRef(onStatus);
  const onExitRef = useRef(onExit);
  const workingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onDataRef.current = onData; });
  useEffect(() => { onStatusRef.current = onStatus; });
  useEffect(() => { onExitRef.current = onExit; });

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!cwd || !terminal) return;

    let cancelled = false;
    const resolvedSessionId = overrideSessionIdRef.current ?? sessionId ?? crypto.randomUUID();
    overrideSessionIdRef.current = null;

    const ws = new WebSocket(deriveWsUrl(wsUrl));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      send({ type: 'start', sessionId: resolvedSessionId, cwd, cols, rows, agentCommand: agentConfig.command, agentArgs: agentConfig.args });
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'session-ready') {
        onStatusRef.current?.('waiting');
      }
      if (msg.type === 'data') {
        terminal.write(msg.data);
        onDataRef.current?.(msg.data);
        // Status transitions: working on data, debounced back to waiting
        onStatusRef.current?.('working');
        if (workingTimerRef.current) {
          clearTimeout(workingTimerRef.current);
        }
        workingTimerRef.current = setTimeout(() => {
          onStatusRef.current?.('waiting');
          workingTimerRef.current = null;
        }, 1200);
      }
      if (msg.type === 'error') console.error('PTY error:', msg.message);
      if (msg.type === 'exit') {
        if (workingTimerRef.current) {
          clearTimeout(workingTimerRef.current);
          workingTimerRef.current = null;
        }
        onStatusRef.current?.(msg.code === 0 ? 'done' : 'error');
        onExitRef.current?.(msg.code);
        setConnected(false);
        console.info('PTY exited with code:', msg.code);
        setTimeout(() => {
          if (!cancelled) {
            // Use a new sessionId so the server spawns a fresh PTY
            // instead of replaying the already-exited session
            overrideSessionIdRef.current = crypto.randomUUID();
            setReconnectKey(k => k + 1);
          }
        }, 800);
      }
    };

    ws.onerror = (err) => console.error('WebSocket error', err);
    ws.onclose = () => setConnected(false);

    return () => {
      cancelled = true;
      if (workingTimerRef.current) {
        clearTimeout(workingTimerRef.current);
        workingTimerRef.current = null;
      }
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [cwd, terminal, reconnectKey, sessionId]); // cols/rows intentionally excluded — resize handled separately

  const sendInput = useCallback((data: string) => send({ type: 'input', data }), [send]);
  const sendResize = useCallback((c: number, r: number) => send({ type: 'resize', cols: c, rows: r }), [send]);

  return { sendInput, sendResize, connected };
}
