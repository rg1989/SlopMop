import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests verify the slop-status endpoint response contract from the client perspective.
// The endpoint is GET /api/slop-status?cwd= → { exists: bool, config: {...} | null }

function fetchSlopStatus(cwd: string) {
  return fetch(`/api/slop-status?cwd=${encodeURIComponent(cwd)}`).then(r => r.json());
}

function postSlopInit(cwd: string, projectName?: string) {
  return fetch('/api/slop-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd, projectName }),
  }).then(r => r.json());
}

describe('GET /api/slop-status', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when cwd param is missing', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ error: 'cwd required' }),
      status: 400,
    });
    const body = await fetch('/api/slop-status').then(r => r.json());
    expect(body).toHaveProperty('error');
  });

  it('returns { exists: true } when .slop/ folder is present in cwd', async () => {
    const config = { version: '1', created: '2026-01-01T00:00:00Z', projectName: 'test', agent: { command: 'claude', args: [], label: 'Claude' } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ exists: true, config }),
    });
    const body = await fetchSlopStatus('/some/project');
    expect(body.exists).toBe(true);
    expect(body.config).not.toBeNull();
  });

  it('returns { exists: false } when .slop/ folder is absent from cwd', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ exists: false, config: null }),
    });
    const body = await fetchSlopStatus('/no-slop-here');
    expect(body.exists).toBe(false);
    expect(body.config).toBeNull();
  });
});

describe('POST /api/slop-init', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when cwd body field is missing', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ error: 'cwd required' }),
      status: 400,
    });
    const body = await fetch('/api/slop-init', { method: 'POST', body: '{}' }).then(r => r.json());
    expect(body).toHaveProperty('error');
  });

  it('returns { ok: true } on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ ok: true, config: { version: '1', created: '2026-01-01T00:00:00Z', projectName: 'test', agent: { command: 'claude', args: [], label: 'Claude' } } }),
    });
    const body = await postSlopInit('/some/project');
    expect(body.ok).toBe(true);
    expect(body.config).toHaveProperty('version', '1');
  });
});
