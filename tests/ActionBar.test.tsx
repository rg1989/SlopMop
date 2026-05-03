import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ActionBar } from '../client/components/ActionBar';

describe('ActionBar', () => {
  it('renders inside .terminal-action-bar container', () => {
    const { container } = render(<ActionBar />);
    expect(container.querySelector('.terminal-action-bar')).not.toBeNull();
  });

  it('renders attach button', () => {
    render(<ActionBar />);
    expect(screen.getByTitle(/attach/i)).toBeTruthy();
  });

  it('renders voiceSlot when provided', () => {
    render(<ActionBar voiceSlot={<span data-testid="voice-slot" />} />);
    expect(screen.getByTestId('voice-slot')).toBeTruthy();
  });

  it('ActionBar is self-contained — no crash when all optional props omitted', () => {
    expect(() => render(<ActionBar />)).not.toThrow();
  });
});
