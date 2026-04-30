import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFileTree } from '../client/hooks/useFileTree';

describe('useFileTree', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it('fetches tree on cwd change — calls /api/files?cwd=... and updates tree state', async () => {
    const fakeTree = [{ name: 'index.ts', path: '/proj/index.ts', type: 'file' }];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tree: fakeTree }),
    });

    const { result } = renderHook(() => useFileTree('/proj'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/files?cwd=')
      );
    });

    await waitFor(() => {
      expect(result.current.tree).toEqual(fakeTree);
    });
  });

  it('setMode to changes calls git-status — fetch called with /api/git-status?cwd=...', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tree: [], changed: ['/proj/modified.ts'] }),
    });

    const { result } = renderHook(() => useFileTree('/proj'));

    // Switch to changes mode
    result.current.setMode('changes');

    await waitFor(() => {
      const calls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((url: string) => url.includes('/api/git-status'))).toBe(true);
    });
  });

  it('setMode to all does not call git-status — switching back to all skips git-status fetch', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tree: [], changed: [] }),
    });

    const { result } = renderHook(() => useFileTree('/proj'));

    // Go to changes mode first to trigger git-status call
    result.current.setMode('changes');

    await waitFor(() => {
      const calls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((url: string) => url.includes('/api/git-status'))).toBe(true);
    });

    const callCountAfterChanges = mockFetch.mock.calls.length;

    // Switch back to all — should NOT trigger another git-status fetch
    result.current.setMode('all');

    // Allow any potential async effects to settle
    await new Promise((resolve) => setTimeout(resolve, 50));

    const callsAfterAll: string[] = mockFetch.mock.calls.slice(callCountAfterChanges).map((c: unknown[]) => c[0] as string);
    expect(callsAfterAll.some((url: string) => url.includes('/api/git-status'))).toBe(false);
  });
});
