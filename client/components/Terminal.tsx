import { useEffect, useRef } from 'react';
import type { Terminal as XTerminal } from '@xterm/xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';
import { useResize } from '../hooks/useResize';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onReady: (terminal: XTerminal) => void;
  sendResize: (cols: number, rows: number) => void;
  /** Bumped by parent when this terminal becomes visible again so we can re-fit + repaint. */
  visibleKey?: number;
  accentHex?: string;
}

export function Terminal({ onReady, sendResize, visibleKey, accentHex }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<XFitAddon | null>(null);

  useEffect(() => {
    let cancelled = false;
    let terminal: XTerminal | undefined;

    async function init() {
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      // StrictMode runs cleanup before the second effect fires — bail if that happened
      if (cancelled) return;

      const accent = accentHex ?? '#d4845a';
      const accentMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent);
      const accentRgb = accentMatch
        ? `${parseInt(accentMatch[1], 16)}, ${parseInt(accentMatch[2], 16)}, ${parseInt(accentMatch[3], 16)}`
        : '212, 132, 90';

      terminal = new XTerm({
        scrollback: 5000,
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
      terminal.loadAddon(fitAddon);

      // WebGL renderer with DOM fallback
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
        });
        terminal.loadAddon(webglAddon);
      } catch {
        // WebGL not available — DOM renderer fallback
      }

      if (containerRef.current) {
        terminal.open(containerRef.current);
        if (containerRef.current.clientWidth && containerRef.current.clientHeight) {
          fitAddon.fit();
        }
        terminal.focus();
      }

      // Inject scrollbar override after xterm opens — static CSS loses the cascade
      // race against xterm's runtime DOM injection, so we must go later.
      if (!document.getElementById('xterm-scrollbar-override')) {
        const s = document.createElement('style');
        s.id = 'xterm-scrollbar-override';
        s.textContent =
          '.xterm-viewport::-webkit-scrollbar{width:6px!important}' +
          '.xterm-viewport::-webkit-scrollbar-track{background:var(--bg)!important}' +
          '.xterm-viewport::-webkit-scrollbar-thumb{background:rgba(var(--accent-rgb),.7)!important;border-radius:3px!important}' +
          '.xterm-viewport::-webkit-scrollbar-thumb:hover{background:var(--accent)!important}' +
          '.xterm-viewport{scrollbar-width:thin!important;scrollbar-color:rgba(var(--accent-rgb),.7) var(--bg)!important}';
        document.head.appendChild(s);
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      onReady(terminal);
    }

    init();

    return () => {
      cancelled = true;
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal?.dispose();
    };
  }, [onReady]);

  useResize(containerRef, terminalRef.current, fitAddonRef.current, sendResize);

  useEffect(() => {
    if (visibleKey === undefined) return;
    const el = containerRef.current;
    const term = terminalRef.current;
    const fit = fitAddonRef.current;
    if (!el || !term || !fit) return;
    if (!el.clientWidth || !el.clientHeight) return;
    requestAnimationFrame(() => {
      try {
        fit.fit();
        sendResize(term.cols, term.rows);
        term.refresh(0, term.rows - 1);
      } catch { /* xterm may be mid-dispose */ }
    });
  }, [visibleKey, sendResize]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0d1117' }}
      onClick={() => terminalRef.current?.focus()}
    />
  );
}
