import { useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export function useResize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  terminalRef: React.RefObject<Terminal | null>,
  fitAddonRef: React.RefObject<FitAddon | null>,
  onResize: (cols: number, rows: number) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const terminal = terminalRef.current;
      const fitAddon = fitAddonRef.current;
      if (!el.clientWidth || !el.clientHeight || !terminal || !fitAddon) return;

      // Debounce both fit() and PTY notification together — calling fit() mid-stream
      // re-wraps the alt screen buffer while Claude is writing, corrupting cursor positions.
      // 300ms gives streaming output time to settle before we resize.
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const t = terminalRef.current;
        const fa = fitAddonRef.current;
        if (!t || !fa) return;
        // Only resize if cols/rows actually changed — avoids redundant re-wrap
        const proposed = fa.proposeDimensions();
        if (!proposed || (proposed.cols === t.cols && proposed.rows === t.rows)) return;
        // Clear scrollback before reflow — xterm's reflow algorithm corrupts ANSI-formatted
        // lines when cols change. The current screen survives: Claude Code redraws on SIGWINCH.
        try { t.clear(); } catch { /* ignore */ }
        try { fa.fit(); } catch { return; }
        // Defer refresh one frame so the WebGL renderer finishes resizing its canvas
        requestAnimationFrame(() => {
          try {
            const t2 = terminalRef.current;
            if (t2) { t2.refresh(0, t2.rows - 1); onResize(t2.cols, t2.rows); }
          } catch { /* ignore mid-dispose errors */ }
        });
      }, 300);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [containerRef, terminalRef, fitAddonRef, onResize]);
}
