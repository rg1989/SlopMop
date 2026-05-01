import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FolderPicker } from '../client/components/FolderPicker';

describe('FolderPicker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads recent paths from GET /api/recent-paths on mount', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/recent-paths') {
        return Promise.resolve({ json: async () => ({ paths: ['/projects/foo'] }) });
      }
      return Promise.resolve({ json: async () => ({ branch: null }) });
    });

    const { getByText } = render(
      <FolderPicker cwd={null} onConnect={vi.fn()} />
    );

    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
      const getCall = calls.find(c => c[0] === '/api/recent-paths');
      expect(getCall).toBeDefined();
    });
  });

  it('calls PUT /api/recent-paths when a folder is connected', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/recent-paths' && opts?.method === 'PUT') {
        return Promise.resolve({ json: async () => ({}) });
      }
      if (url === '/api/recent-paths') {
        return Promise.resolve({ json: async () => ({ paths: [] }) });
      }
      if (typeof url === 'string' && url.startsWith('/api/git-branch')) {
        return Promise.resolve({ json: async () => ({ branch: null }) });
      }
      return Promise.resolve({ json: async () => ({}) });
    });

    render(
      <FolderPicker cwd="/projects/bar" onConnect={vi.fn()} />
    );

    await waitFor(() => {
      const allCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
      const putCall = allCalls.find(c => c[0] === '/api/recent-paths' && c[1]?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall as [string, RequestInit])[1].body as string);
      expect(body.paths).toContain('/projects/bar');
    });
  });
});
