import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

// Mock the ResizeObserver (jsdom doesn't implement it)
let resizeObserverCallback: ResizeObserverCallback | null = null;
let mockObservedElement: Element | null = null;
let mockDisconnected = false;

const MockResizeObserver = vi.fn((callback: ResizeObserverCallback) => {
  resizeObserverCallback = callback;
  return {
    observe: vi.fn((el: Element) => {
      mockObservedElement = el;
    }),
    disconnect: vi.fn(() => {
      mockDisconnected = true;
    }),
    unobserve: vi.fn(),
  };
});

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock @xterm/addon-fit
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
  })),
}));

// Mock @xterm/xterm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    cols: 80,
    rows: 24,
    open: vi.fn(),
    loadAddon: vi.fn(),
    dispose: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    onContextLoss: vi.fn(),
  })),
}));

import { useResize } from '../client/hooks/useResize';

describe('useResize', () => {
  let mockTerminal: Terminal;
  let mockFitAddon: FitAddon;
  let containerRef: React.RefObject<HTMLDivElement | null>;
  let onResize: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    resizeObserverCallback = null;
    mockObservedElement = null;
    mockDisconnected = false;
    MockResizeObserver.mockClear();

    mockTerminal = {
      cols: 80,
      rows: 24,
      open: vi.fn(),
      loadAddon: vi.fn(),
      dispose: vi.fn(),
      write: vi.fn(),
      onData: vi.fn(),
    } as unknown as Terminal;

    mockFitAddon = {
      fit: vi.fn(),
      proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
    } as unknown as FitAddon;

    onResize = vi.fn();

    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
    containerRef = { current: el } as React.RefObject<HTMLDivElement | null>;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onResize exactly once after 150ms when ResizeObserver fires', () => {
    renderHook(() =>
      useResize(containerRef, mockTerminal, mockFitAddon, onResize)
    );

    // Trigger the resize observer
    resizeObserverCallback!([], {} as ResizeObserver);

    // Before 150ms — should not fire
    vi.advanceTimersByTime(149);
    expect(onResize).not.toHaveBeenCalled();

    // At exactly 150ms — should fire exactly once
    vi.advanceTimersByTime(1);
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire before 150ms debounce window elapses', () => {
    renderHook(() =>
      useResize(containerRef, mockTerminal, mockFitAddon, onResize)
    );

    resizeObserverCallback!([], {} as ResizeObserver);

    vi.advanceTimersByTime(149);
    expect(onResize).not.toHaveBeenCalled();
  });

  it('passes terminal.cols and terminal.rows to onResize', () => {
    mockTerminal = { ...mockTerminal, cols: 120, rows: 30 } as Terminal;

    renderHook(() =>
      useResize(containerRef, mockTerminal, mockFitAddon, onResize)
    );

    resizeObserverCallback!([], {} as ResizeObserver);
    vi.advanceTimersByTime(150);

    expect(onResize).toHaveBeenCalledWith(120, 30);
  });

  it('debounces multiple rapid fires — only calls onResize once', () => {
    renderHook(() =>
      useResize(containerRef, mockTerminal, mockFitAddon, onResize)
    );

    // Fire multiple times rapidly
    resizeObserverCallback!([], {} as ResizeObserver);
    vi.advanceTimersByTime(100);
    resizeObserverCallback!([], {} as ResizeObserver);
    vi.advanceTimersByTime(100);
    resizeObserverCallback!([], {} as ResizeObserver);
    // Last schedule: +150ms from final callback → need 350ms total after first fire
    vi.advanceTimersByTime(350);

    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('cleans up ResizeObserver on unmount', () => {
    const { unmount } = renderHook(() =>
      useResize(containerRef, mockTerminal, mockFitAddon, onResize)
    );

    expect(MockResizeObserver).toHaveBeenCalledTimes(1);
    const observerInstance = MockResizeObserver.mock.results[0].value;

    unmount();

    expect(observerInstance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not set up observer when terminal is null', () => {
    renderHook(() =>
      useResize(containerRef, null, mockFitAddon, onResize)
    );

    // No observer should be created since terminal is null
    expect(MockResizeObserver).not.toHaveBeenCalled();
  });

  it('does not set up observer when fitAddon is null', () => {
    renderHook(() =>
      useResize(containerRef, mockTerminal, null, onResize)
    );

    expect(MockResizeObserver).not.toHaveBeenCalled();
  });
});
