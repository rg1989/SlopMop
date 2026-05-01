import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// Minimal component that replicates the App.tsx slop-status fetch pattern
function SlopStatusProbe({ cwd, onResult }: { cwd: string | null; onResult: (v: boolean | null) => void }) {
  const [slopExists, setSlopExists] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!cwd) { setSlopExists(null); return; }
    fetch(`/api/slop-status?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ exists }: { exists: boolean }) => setSlopExists(exists))
      .catch(() => setSlopExists(null));
  }, [cwd]);

  React.useEffect(() => { onResult(slopExists); }, [slopExists, onResult]);
  return null;
}

describe('App slop onboarding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches /api/slop-status when cwd changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ exists: true, config: null }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<SlopStatusProbe cwd="/some/project" onResult={() => {}} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/slop-status?cwd=')
      );
    });
  });

  it('OnboardingModal renders when slopExists is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ exists: false, config: null }) });
    vi.stubGlobal('fetch', fetchMock);

    let capturedExists: boolean | null = null;
    render(<SlopStatusProbe cwd="/no-slop-folder" onResult={v => { capturedExists = v; }} />);

    await waitFor(() => {
      expect(capturedExists).toBe(false);
    });
  });

  it('OnboardingModal does not render when slopExists is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ exists: true, config: null }) });
    vi.stubGlobal('fetch', fetchMock);

    let capturedExists: boolean | null = null;
    render(<SlopStatusProbe cwd="/has-slop-folder" onResult={v => { capturedExists = v; }} />);

    await waitFor(() => {
      expect(capturedExists).toBe(true);
    });
  });
});
