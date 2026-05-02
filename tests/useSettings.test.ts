import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings } from '../client/hooks/useSettings';

const STORAGE_KEY = 'slopmop_settings';

describe('useSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads settings from server on mount, overwriting localStorage', async () => {
    const serverSettings = {
      recordingMode: 'hold',
      pttKey: null,
      sidebarTabsOrientation: 'horizontal',
      showHiddenFiles: true,
      agent: { command: 'claude', args: [], label: 'Claude' },
      typeIndicatorSize: 14,
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ settings: serverSettings }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings.recordingMode).toBe('hold');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('falls back to localStorage if server returns null', async () => {
    const localSettings = {
      recordingMode: 'toggle',
      pttKey: null,
      sidebarTabsOrientation: 'horizontal',
      showHiddenFiles: false,
      agent: { command: 'claude', args: [], label: 'Claude' },
      typeIndicatorSize: 14,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localSettings));

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ json: async () => ({ settings: null }) })
      .mockResolvedValueOnce({ json: async () => ({}) });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(result.current.settings.showHiddenFiles).toBe(false);
  });

  it('PUT /api/global-settings called on update()', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ settings: null }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/global-settings');
    });

    (fetch as ReturnType<typeof vi.fn>).mockClear();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ json: async () => ({}) });

    act(() => {
      result.current.update({ recordingMode: 'hold' });
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/global-settings',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    const allCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const putCall = allCalls.find(c => c[0] === '/api/global-settings' && c[1]?.method === 'PUT');
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall as [string, RequestInit])[1].body as string);
    expect(body.settings.recordingMode).toBe('hold');
  });

  it('migration: writes localStorage value to server if server returns null', async () => {
    const localSettings = {
      recordingMode: 'toggle',
      pttKey: null,
      sidebarTabsOrientation: 'vertical',
      showHiddenFiles: true,
      agent: { command: 'claude', args: [], label: 'Claude' },
      typeIndicatorSize: 11,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localSettings));

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ json: async () => ({ settings: null }) })
      .mockResolvedValueOnce({ json: async () => ({}) });

    renderHook(() => useSettings());

    await waitFor(() => {
      const allCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
      const putCall = allCalls.find(c => c[0] === '/api/global-settings' && c[1]?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall as [string, RequestInit])[1].body as string);
      expect(body.settings.typeIndicatorSize).toBe(11);
    });
  });
});
