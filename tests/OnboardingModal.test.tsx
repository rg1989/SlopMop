import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OnboardingModal } from '../client/components/OnboardingModal';

describe('OnboardingModal', () => {
  beforeEach(() => {
    localStorage.removeItem('slopdock_onboarded');
  });

  it('ONBOARD-01 — renders when no saved folder + not yet onboarded', () => {
    render(<OnboardingModal initialPath={null} onDismiss={vi.fn()} />);
    expect(screen.getByText('Welcome to SlopDock')).toBeInTheDocument();
  });

  it('ONBOARD-02 — does NOT render when initialPath is set', () => {
    render(<OnboardingModal initialPath="/some/path" onDismiss={vi.fn()} />);
    expect(screen.queryByText('Welcome to SlopDock')).toBeNull();
  });

  it('ONBOARD-03 — dismissing modal sets localStorage key', () => {
    render(<OnboardingModal initialPath={null} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(localStorage.getItem('slopdock_onboarded')).toBe('1');
  });
});
