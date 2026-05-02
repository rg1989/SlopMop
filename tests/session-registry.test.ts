import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SESSION_TTL_MS = 30 * 60 * 1000; // matches the module constant

describe('SessionRegistry buffer replay (PTY-02)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getBuffer returns accumulated output written after spawn', async () => {
    const { SessionRegistry } = await import('../server/session-registry');
    const registry = new SessionRegistry();

    const mockPty = { kill: vi.fn() } as unknown as import('node-pty').IPty;
    registry.create('session-1', mockPty, '/tmp', vi.fn());

    registry.appendBuffer('session-1', 'hello ');
    registry.appendBuffer('session-1', 'world');

    expect(registry.getBuffer('session-1')).toBe('hello world');
  });

  it('getBuffer returns empty string for unknown session', async () => {
    const { SessionRegistry } = await import('../server/session-registry');
    const registry = new SessionRegistry();

    expect(registry.getBuffer('nonexistent-id')).toBe('');
  });
});

describe('SessionRegistry TTL cleanup (PTY-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes session after SESSION_TTL_MS elapses', async () => {
    const { SessionRegistry } = await import('../server/session-registry');
    const registry = new SessionRegistry();

    const mockPty = { kill: vi.fn() } as unknown as import('node-pty').IPty;
    registry.create('ttl-session', mockPty, '/tmp', vi.fn());

    registry.detach('ttl-session');

    vi.advanceTimersByTime(SESSION_TTL_MS + 1);

    expect(registry.get('ttl-session')).toBeUndefined();
  });
});
