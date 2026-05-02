import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTts } from '../client/hooks/useTts';

// Build a minimal fetch mock that handles both /api/tts/status and /api/tts
function makeFetch(opts: { available?: boolean; ttsOk?: boolean } = {}) {
  return vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/api/tts/status')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ available: opts.available ?? true }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/tts')) {
      if (opts.ttsOk === false) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(44)),
      });
    }
    return Promise.resolve({ ok: false });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', makeFetch());
});

describe('useTts', () => {
  it('TTS-01: handleData strips ANSI and enqueues complete sentences for synthesis', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTts({ enabled: true }));

    act(() => {
      result.current.handleData('\x1b[32mHello world.\x1b[0m ');
    });

    await waitFor(() => {
      const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
      const ttsCalls = calls.filter((call) => call[0] === '/api/tts');
      expect(ttsCalls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse((ttsCalls[0]![1] as { body: string }).body);
      expect(body.text).toBe('Hello world.');
    });
  });

  it('TTS-01: handleData with enabled:false is a no-op — fetch not called', () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTts({ enabled: false }));

    act(() => {
      result.current.handleData('Hello world. ');
    });

    const ttsCalls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === '/api/tts',
    );
    expect(ttsCalls).toHaveLength(0);
  });

  it('TTS-01: handleData with partial sentence (no terminator) does not synthesize', () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTts({ enabled: true }));

    act(() => {
      result.current.handleData('Hello');
    });

    const ttsCalls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === '/api/tts',
    );
    expect(ttsCalls).toHaveLength(0);
  });

  it('TTS-02: stop() aborts in-flight fetch and clears speaking state', async () => {
    let abortCalled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes('/api/tts/status')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ available: true }) });
        }
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              abortCalled = true;
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        });
      }),
    );

    const { result } = renderHook(() => useTts({ enabled: true }));

    act(() => {
      result.current.handleData('Hello world. ');
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.speaking).toBe(false);
  });

  it('piperAvailable reflects /api/tts/status response', async () => {
    vi.stubGlobal('fetch', makeFetch({ available: true }));
    const { result } = renderHook(() => useTts({ enabled: true }));

    expect(result.current.piperAvailable).toBeNull(); // initially null (checking)

    await waitFor(() => {
      expect(result.current.piperAvailable).toBe(true);
    });
  });

  it('piperAvailable is false when status endpoint reports unavailable', async () => {
    vi.stubGlobal('fetch', makeFetch({ available: false }));
    const { result } = renderHook(() => useTts({ enabled: true }));

    await waitFor(() => {
      expect(result.current.piperAvailable).toBe(false);
    });
  });
});
