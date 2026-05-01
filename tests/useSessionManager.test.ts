import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useSessionManager } from '../client/hooks/useSessionManager';

describe('useSessionManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('spawn', () => {
    it('adds a new SessionEntry to sessions array', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.spawn('/home/user/project');
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0]).toMatchObject({
        cwd: '/home/user/project',
        status: 'connecting',
      });
    });

    it('returns a string UUID', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string | undefined;
      act(() => {
        id = result.current.spawn('/home/user/project');
      });

      expect(typeof id).toBe('string');
      expect(id).toBeTruthy();
    });

    it('initializes new session with name "New"', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.spawn('/home/user/project');
      });

      expect(result.current.sessions[0].name).toBe('New');
    });

    it('creates a new "New" tab for each non-initial spawn', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.spawn('/home/user/project');
      });

      act(() => {
        result.current.spawn('/home/user/project');
      });

      // After re-render between spawns, second spawn deduplicates to the existing "New" tab
      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].name).toBe('New');
    });

    it('includes id, name, status, cwd, createdAt in session entry', () => {
      const { result } = renderHook(() => useSessionManager());
      const before = Date.now();

      act(() => {
        result.current.spawn('/tmp');
      });

      const session = result.current.sessions[0];
      expect(session.id).toBeTruthy();
      expect(session.name).toBe('New');
      expect(session.status).toBe('connecting');
      expect(session.cwd).toBe('/tmp');
      expect(typeof session.createdAt).toBe('number');
      expect(session.createdAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('close', () => {
    it('removes session from sessions array', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/home/user/project');
      });

      act(() => {
        result.current.close(id);
      });

      expect(result.current.sessions).toHaveLength(0);
    });

    it('writes PersistedSession to localStorage under slopdock_sessions_${cwd}', () => {
      const { result } = renderHook(() => useSessionManager());

      let id = '';
      act(() => {
        id = result.current.spawn('/home/user/project');
      });

      act(() => {
        result.current.close(id);
      });

      const raw = localStorage.getItem('slopdock_sessions_/home/user/project');
      expect(raw).not.toBeNull();
      const history = JSON.parse(raw!);
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(id);
      expect(history[0].cwd).toBe('/home/user/project');
    });

    it('sets activeId to previous session when closing the active session', () => {
      const { result } = renderHook(() => useSessionManager());

      let id1 = '';
      let id2 = '';
      act(() => {
        id1 = result.current.spawn('/tmp');
        id2 = result.current.spawn('/tmp');
      });

      // Make id2 active
      act(() => {
        result.current.setActive(id2);
      });

      // Close active session (id2)
      act(() => {
        result.current.close(id2);
      });

      expect(result.current.activeId).toBe(id1);
    });

    it('sets activeId to null when closing the last session', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/tmp');
      });

      act(() => {
        result.current.close(id);
      });

      expect(result.current.activeId).toBeNull();
    });
  });

  describe('session naming', () => {
    it('first updateName call sets the session name', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/tmp');
      });

      act(() => {
        result.current.updateName(id, 'hello');
      });

      const session = result.current.sessions.find(s => s.id === id);
      expect(session?.name).toBe('hello');
    });

    it('subsequent updateName calls do not change the name after first call', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/tmp');
      });

      act(() => {
        result.current.updateName(id, 'first prompt');
      });

      act(() => {
        result.current.updateName(id, 'second prompt');
      });

      const session = result.current.sessions.find(s => s.id === id);
      expect(session?.name).toBe('first prompt');
    });
  });

  describe('status', () => {
    it('updateStatus changes the session status', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/tmp');
      });

      act(() => {
        result.current.updateStatus(id, 'working');
      });

      const session = result.current.sessions.find(s => s.id === id);
      expect(session?.status).toBe('working');
    });

    it('updateStatus can transition through all statuses', () => {
      const { result } = renderHook(() => useSessionManager());

      let id: string;
      act(() => {
        id = result.current.spawn('/tmp');
      });

      const statuses = ['waiting', 'working', 'done', 'error'] as const;
      for (const status of statuses) {
        act(() => {
          result.current.updateStatus(id, status);
        });
        const session = result.current.sessions.find(s => s.id === id);
        expect(session?.status).toBe(status);
      }
    });
  });

  describe('history', () => {
    it('loads pre-populated localStorage history on hook init', () => {
      const cwd = '/home/user/project';
      const preExisting = [
        {
          id: 'old-session-id',
          name: 'Old Session',
          cwd,
          status: 'done',
          closedAt: Date.now() - 1000,
        },
      ];
      localStorage.setItem(`slopdock_sessions_${cwd}`, JSON.stringify(preExisting));

      const { result } = renderHook(() => useSessionManager());

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].id).toBe('old-session-id');
      expect(result.current.history[0].name).toBe('Old Session');
    });

    it('history is empty when localStorage has no entry', () => {
      const { result } = renderHook(() => useSessionManager());

      expect(result.current.history).toEqual([]);
    });
  });

  describe('dedup guard for initial spawn', () => {
    it('calling spawn with initial:true twice returns the same id', () => {
      const { result } = renderHook(() => useSessionManager());

      let id1 = '';
      let id2 = '';
      act(() => {
        id1 = result.current.spawn('/tmp', { initial: true });
        id2 = result.current.spawn('/tmp', { initial: true });
      });

      expect(id1).toBeTruthy();
      expect(id2).toBe(id1);
    });

    it('sessions.length === 1 after two initial spawns', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.spawn('/tmp', { initial: true });
        result.current.spawn('/tmp', { initial: true });
      });

      expect(result.current.sessions).toHaveLength(1);
    });

    it('non-initial spawn does not trigger the initial dedup path', () => {
      const { result } = renderHook(() => useSessionManager());

      act(() => {
        result.current.spawn('/tmp', { initial: true });
      });

      let nonInitialId = '';
      act(() => {
        nonInitialId = result.current.spawn('/tmp');
      });

      expect(result.current.sessions).toHaveLength(2);
      expect(nonInitialId).not.toBe(result.current.sessions[0].id);
    });
  });
});
