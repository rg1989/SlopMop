import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SessionTabBar } from '../client/components/SessionTabBar';

type SessionStatus = 'connecting' | 'waiting' | 'working' | 'done' | 'error';

interface SessionEntry {
  id: string;
  name: string;
  status: SessionStatus;
  cwd: string;
  createdAt: number;
}

const makeSessions = (count: number): SessionEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `session-${i + 1}`,
    name: `Session ${i + 1}`,
    status: 'waiting' as SessionStatus,
    cwd: '/tmp',
    createdAt: Date.now(),
  }));

describe('SessionTabBar', () => {
  it('renders one tab element per session in the sessions array', () => {
    const sessions = makeSessions(3);

    render(
      <SessionTabBar
        sessions={sessions}
        activeId="session-1"
        onSetActive={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
      />
    );

    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    expect(screen.getByText('Session 3')).toBeInTheDocument();
  });

  it('renders no tabs when sessions array is empty', () => {
    const { container } = render(
      <SessionTabBar
        sessions={[]}
        activeId={null}
        onSetActive={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
      />
    );

    // No session tabs rendered
    expect(screen.queryByText(/^Session/)).toBeNull();
  });

  it('active session tab has "active" CSS class', () => {
    const sessions = makeSessions(2);

    const { container } = render(
      <SessionTabBar
        sessions={sessions}
        activeId="session-2"
        onSetActive={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
      />
    );

    // Find all tab elements and check the active one
    const tabs = container.querySelectorAll('[data-session-id]');
    const tab1 = container.querySelector('[data-session-id="session-1"]');
    const tab2 = container.querySelector('[data-session-id="session-2"]');

    expect(tab1).not.toHaveClass('active');
    expect(tab2).toHaveClass('active');
  });

  it('clicking a tab calls onSetActive with the session id', () => {
    const sessions = makeSessions(2);
    const onSetActive = vi.fn();

    render(
      <SessionTabBar
        sessions={sessions}
        activeId="session-1"
        onSetActive={onSetActive}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Session 2'));
    expect(onSetActive).toHaveBeenCalledWith('session-2');
  });

  it('clicking the close button on a tab calls onClose with session id', () => {
    const sessions = makeSessions(2);
    const onClose = vi.fn();

    const { container } = render(
      <SessionTabBar
        sessions={sessions}
        activeId="session-1"
        onSetActive={vi.fn()}
        onClose={onClose}
        onSpawn={vi.fn()}
      />
    );

    // Close button for session-2
    const tab2 = container.querySelector('[data-session-id="session-2"]');
    const closeBtn = tab2?.querySelector('button[data-close]') ?? tab2?.querySelector('.tab-close') ?? tab2?.querySelector('button');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);

    expect(onClose).toHaveBeenCalledWith('session-2');
  });

  it('clicking close button does not propagate to tab click (onSetActive not called)', () => {
    const sessions = makeSessions(1);
    const onSetActive = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <SessionTabBar
        sessions={sessions}
        activeId={null}
        onSetActive={onSetActive}
        onClose={onClose}
        onSpawn={vi.fn()}
      />
    );

    const tab = container.querySelector('[data-session-id="session-1"]');
    const closeBtn = tab?.querySelector('button[data-close]') ?? tab?.querySelector('.tab-close') ?? tab?.querySelector('button');
    fireEvent.click(closeBtn!);

    expect(onClose).toHaveBeenCalledWith('session-1');
    expect(onSetActive).not.toHaveBeenCalled();
  });

  it('tab has status class matching session status', () => {
    const sessions: SessionEntry[] = [
      { id: 'session-1', name: 'Session 1', status: 'working', cwd: '/tmp', createdAt: Date.now() },
    ];

    const { container } = render(
      <SessionTabBar
        sessions={sessions}
        activeId="session-1"
        onSetActive={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
      />
    );

    // Status chip should have status--working class
    const statusChip = container.querySelector('.status--working');
    expect(statusChip).not.toBeNull();
  });
});
