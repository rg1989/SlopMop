import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 RED)
import { useProjectHealth } from '../client/hooks/useProjectHealth';

const mockHealthResponse = {
  dirAccessible: true,
  isGitRepo: true,
  hasClaudeMd: false,
  agentFound: true,
  agentPath: '/usr/local/bin/claude',
  hasNodeModules: null,
};

describe('useProjectHealth', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockHealthResponse),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('HEALTH-01 — returns loading:true then resolves with health data', async () => {
    const { result } = renderHook(() => useProjectHealth('/some/path'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isGitRepo).toBe(true);
  });

  it('HEALTH-02 — resets to loading when cwd changes', async () => {
    let cwd = '/path/one';
    const { result, rerender } = renderHook(() => useProjectHealth(cwd));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      cwd = '/path/two';
      rerender();
    });

    expect(result.current.loading).toBe(true);
  });
});
