import { useState, useRef, useCallback } from 'react';

interface UseDragResizeReturn {
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Drag-to-resize a panel by a handle on its edge.
 *
 * direction: 'left'  — dragging right increases width (sidebar on the left)
 *            'right' — dragging left increases width  (preview on the right)
 * maxRef:    mutable ref updated each render with the current max width;
 *            the drag handler reads it live so it always respects the latest layout.
 */
export function useDragResize(
  initial: number,
  min: number,
  direction: 'left' | 'right',
  maxRef?: React.RefObject<number>,
): UseDragResizeReturn {
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

  return { width, setWidth, isDragging, onMouseDown };
}
