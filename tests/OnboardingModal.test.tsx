import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { OnboardingModal } from '../client/components/OnboardingModal';

describe('OnboardingModal', () => {
  beforeEach(() => {
    localStorage.removeItem('slopmop_onboarded');
  });

  it('ONBOARD-01 — renders when no saved folder + not yet onboarded', () => {
    render(<OnboardingModal initialPath={null} onDismiss={vi.fn()} />);
    expect(screen.getByText('Welcome to SlopMop')).toBeInTheDocument();
  });

  it('ONBOARD-02 — does NOT render when initialPath is set', () => {
    render(<OnboardingModal initialPath="/some/path" onDismiss={vi.fn()} />);
    expect(screen.queryByText('Welcome to SlopMop')).toBeNull();
  });

  it('ONBOARD-03 — dismissing modal sets localStorage key', () => {
    render(<OnboardingModal initialPath={null} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(localStorage.getItem('slopmop_onboarded')).toBe('1');
  });
});

describe('Phase 6 — prop-driven modal', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders when passed cwd prop without internal gating', () => {
    render(<OnboardingModal cwd="/test/project" onInit={vi.fn()} />);
    expect(screen.getByText('Welcome to SlopMop')).toBeInTheDocument();
  });

  it('Get Started button calls POST /api/slop-init with body {cwd}', async () => {
    render(<OnboardingModal cwd="/test/project" onInit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(fetchSpy).toHaveBeenCalledWith('/api/slop-init', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ cwd: '/test/project' }),
    }));
  });

  it('calls onInit after fetch resolves', async () => {
    const onInit = vi.fn();
    render(<OnboardingModal cwd="/test/project" onInit={onInit} />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    await vi.waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT read localStorage', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    render(<OnboardingModal cwd="/test/project" onInit={vi.fn()} />);
    expect(getSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
  });
});
