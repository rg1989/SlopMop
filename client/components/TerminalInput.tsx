import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalInputHandle {
  focus: () => void;
  injectText: (text: string) => void;
}

interface TerminalInputProps {
  sendInput: (data: string) => void;
  connected: boolean;
  accentHex?: string;
  onSlashOpen?: () => void;
  onSlashClose?: () => void;
  onSlashNavigate?: (direction: 1 | -1) => void;
  onSlashSelect?: () => void;
}

export const TerminalInput = forwardRef<TerminalInputHandle, TerminalInputProps>(
  function TerminalInput({ sendInput, connected: _connected, accentHex, onSlashOpen, onSlashClose, onSlashNavigate, onSlashSelect }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fitAddonRef = useRef<XFitAddon | null>(null);
    const [terminal, setTerminal] = useState<XTerminal | null>(null);
    const slashOpenRef = useRef(false);
    const inputEmptyRef = useRef(true);

    useImperativeHandle(ref, () => ({
      focus: () => terminal?.focus(),
      injectText: (text: string) => {
        terminal?.paste('\x7f' + text);
        slashOpenRef.current = false;
        inputEmptyRef.current = true;
      },
    }), [terminal]);

    useEffect(() => {
      let cancelled = false;
      let term: XTerminal | undefined;

      async function init() {
        const { Terminal: XTerm } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        if (cancelled) return;

        const accent = accentHex ?? '#d4845a';
        const accentMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent);
        const accentRgb = accentMatch
          ? `${parseInt(accentMatch[1], 16)}, ${parseInt(accentMatch[2], 16)}, ${parseInt(accentMatch[3], 16)}`
          : '212, 132, 90';

        term = new XTerm({
          rows: 4,
          scrollback: 0,
          cursorBlink: true,
          theme: {
            background: '#0d1117',
            foreground: '#c9d1d9',
            cursor: accent,
            cursorAccent: '#0d1117',
            selectionBackground: `rgba(${accentRgb}, 0.35)`,
            black: '#21262d',
            red: '#f85149',
            green: '#7ee787',
            yellow: '#e3b341',
            blue: '#79c0ff',
            magenta: '#d2a8ff',
            cyan: '#76e3ea',
            white: '#c9d1d9',
            brightBlack: '#6e7681',
            brightRed: '#ffa198',
            brightGreen: '#a5f3b0',
            brightYellow: '#f0c070',
            brightBlue: '#a5d6ff',
            brightMagenta: '#e2b9ff',
            brightCyan: '#b3f0f7',
            brightWhite: '#e6edf3',
          },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (containerRef.current) {
          term.open(containerRef.current);
          if (containerRef.current.clientWidth) fitAddon.fit();
          term.focus();
        }

        term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
          if (e.type !== 'keydown') return true;
          if (slashOpenRef.current) {
            if (e.key === 'ArrowUp') { onSlashNavigate?.(-1); return false; }
            if (e.key === 'ArrowDown') { onSlashNavigate?.(1); return false; }
            if (e.key === 'Enter') { onSlashSelect?.(); return false; }
            if (e.key === 'Escape') { slashOpenRef.current = false; onSlashClose?.(); return false; }
            slashOpenRef.current = false;
            onSlashClose?.();
            return true;
          }
          if (e.key === '/' && inputEmptyRef.current) {
            slashOpenRef.current = true;
            onSlashOpen?.();
            return true;
          }
          return true;
        });

        fitAddonRef.current = fitAddon;
        setTerminal(term);
      }

      init();

      return () => {
        cancelled = true;
        term?.dispose();
        fitAddonRef.current = null;
        setTerminal(null);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (!terminal) return;
      const disposable = terminal.onData((data) => {
        if (data === '\r') inputEmptyRef.current = true;
        else inputEmptyRef.current = false;
        sendInput(data);
      });
      return () => disposable.dispose();
    }, [terminal, sendInput]);

    return (
      <div
        ref={containerRef}
        className="terminal-input-strip"
        style={{ width: '100%', background: '#0d1117' }}
      />
    );
  }
);
