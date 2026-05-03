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
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const terminal = terminalRef.current;
        const fitAddon = fitAddonRef.current;
        if (!el.clientWidth || !el.clientHeight || !terminal || !fitAddon) return;
        fitAddon.fit();
        onResize(terminal.cols, terminal.rows);
      }, 150);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [containerRef, terminalRef, fitAddonRef, onResize]);
}
