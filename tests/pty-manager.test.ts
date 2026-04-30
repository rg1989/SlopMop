import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — factory cannot reference variables defined below.
// Use vi.hoisted() to create mocks that are available at hoist time.
const mockPtyProcess = vi.hoisted(() => ({
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  pid: 12345,
}));

const mockSpawn = vi.hoisted(() => vi.fn(() => mockPtyProcess));

vi.mock('node-pty', () => ({
  spawn: mockSpawn,
}));

// Import after mocking
import { spawnSession, resizeSession } from '../server/pty-manager';

describe('pty-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire the default return after clearAllMocks resets the fn
    mockSpawn.mockReturnValue(mockPtyProcess);
  });

  describe('spawnSession', () => {
    it('spawns PTY with correct cwd (TERM-01)', () => {
      spawnSession('/tmp/test', 80, 24);

      expect(mockSpawn).toHaveBeenCalledOnce();
      const callArgs = mockSpawn.mock.calls[0];
      const options = callArgs[2];
      expect(options.cwd).toBe('/tmp/test');
    });

    it('sets TERM=xterm-256color in spawn env (TERM-02)', () => {
      spawnSession('/tmp/test', 80, 24);

      expect(mockSpawn).toHaveBeenCalledOnce();
      const callArgs = mockSpawn.mock.calls[0];
      const options = callArgs[2];
      expect(options.env.TERM).toBe('xterm-256color');
    });

    it('sets TERM env var even when process.env does not have it (TERM-02)', () => {
      const originalTerm = process.env.TERM;
      delete process.env.TERM;

      spawnSession('/tmp/test', 80, 24);

      const callArgs = mockSpawn.mock.calls[0];
      const options = callArgs[2];
      expect(options.env.TERM).toBe('xterm-256color');

      if (originalTerm !== undefined) {
        process.env.TERM = originalTerm;
      }
    });

    it('passes cols and rows to pty.spawn options (TERM-01)', () => {
      spawnSession('/tmp/test', 120, 40);

      expect(mockSpawn).toHaveBeenCalledOnce();
      const callArgs = mockSpawn.mock.calls[0];
      const options = callArgs[2];
      expect(options.cols).toBe(120);
      expect(options.rows).toBe(40);
    });

    it('returns the pty process object', () => {
      const result = spawnSession('/tmp/test', 80, 24);
      expect(result).toBe(mockPtyProcess);
    });
  });

  describe('resizeSession', () => {
    it('calls ptyProcess.resize with cols and rows (TERM-05 precursor)', () => {
      resizeSession(mockPtyProcess as any, 120, 40);
      expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
    });
  });
});
