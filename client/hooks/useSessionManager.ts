import { useState, useCallback, useEffect, useRef } from 'react';

export type SessionStatus = 'connecting' | 'waiting' | 'working' | 'done' | 'error';

export interface SessionEntry {
  id: string;
  name: string;
  status: SessionStatus;
  cwd: string;
  createdAt: number;
}

export interface PersistedSession {
  id: string;
  name: string;
  cwd: string;
  status: 'done' | 'error';
  closedAt: number;
}

export interface UseSessionManagerReturn {
  sessions: SessionEntry[];
  activeId: string | null;
  hasPrompted: boolean;
  spawn: (cwd: string, opts?: { initial?: boolean }) => string;
  close: (id: string) => void;
  setActive: (id: string) => void;
  updateName: (id: string, name: string) => void;
  updateStatus: (id: string, status: SessionStatus) => void;
  history: PersistedSession[];
  restoreForCwd: (cwd: string) => void;
}

const HISTORY_KEY = (cwd: string) => `slopmop_sessions_${cwd}`;
const ACTIVE_KEY = (cwd: string) => `slopmop_active:${encodeURIComponent(cwd)}`;
const MAX_HISTORY = 20;
const MAX_SESSIONS = 8;

function loadHistory(cwd: string): PersistedSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(cwd));
    return raw ? (JSON.parse(raw) as PersistedSession[]) : [];
  } catch { return []; }
}

function saveToHistory(cwd: string, entry: PersistedSession) {
  try {
    const existing = loadHistory(cwd);
    localStorage.setItem(HISTORY_KEY(cwd), JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY)));
  } catch {}
}

function loadActiveSessions(cwd: string): { sessions: SessionEntry[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY(cwd));
    if (!raw) return { sessions: [], activeId: null };
    return JSON.parse(raw) as { sessions: SessionEntry[]; activeId: string | null };
  } catch { return { sessions: [], activeId: null }; }
}

function saveActiveSessions(cwd: string, sessions: SessionEntry[], activeId: string | null) {
  try {
    if (sessions.length === 0) {
      localStorage.removeItem(ACTIVE_KEY(cwd));
    } else {
      localStorage.setItem(ACTIVE_KEY(cwd), JSON.stringify({ sessions, activeId }));
    }
  } catch {}
}

export function useSessionManager(): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<PersistedSession[]>([]);
  const [hasPrompted, setHasPrompted] = useState(false);

  const namedSessionsRef = useRef<Set<string>>(new Set());
  const sessionsRef = useRef<SessionEntry[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const initialSessionIdRef = useRef<string | null>(null);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Persist active sessions whenever they change — derive cwd from first session
  useEffect(() => {
    const cwd = sessions[0]?.cwd;
    if (!cwd) return;
    saveActiveSessions(cwd, sessions, activeId);
  }, [sessions, activeId]);

  // Load all session history from localStorage on mount
  useEffect(() => {
    const allHistory: PersistedSession[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('slopmop_sessions_')) {
          const cwd = key.replace('slopmop_sessions_', '');
          allHistory.push(...loadHistory(cwd));
        }
      }
    } catch {}
    allHistory.sort((a, b) => b.closedAt - a.closedAt);
    setHistory(allHistory);
  }, []);

  // Restore active sessions for a given cwd — call this before spawn() on initial load
  const restoreForCwd = useCallback((cwd: string) => {
    const { sessions: saved, activeId: savedActiveId } = loadActiveSessions(cwd);
    if (!saved.length) return;

    const reconnecting: SessionEntry[] = saved.map(s => ({ ...s, status: 'connecting' as SessionStatus }));
    const initialSession = reconnecting.find(s => s.name === '') ?? reconnecting[0];
    initialSessionIdRef.current = initialSession?.id ?? null;
    setSessions(reconnecting);
    setActiveId(savedActiveId ?? initialSession?.id ?? null);
    // If any restored session has a real name, the user already sent a message — restore the unlocked state
    if (reconnecting.some(s => s.name && s.name !== '' && s.name !== 'New')) {
      setHasPrompted(true);
    }
  }, []);

  const spawn = useCallback((cwd: string, { initial = false }: { initial?: boolean } = {}): string => {
    const current = sessionsRef.current;
    if (current.length >= MAX_SESSIONS) {
      return activeIdRef.current ?? current[current.length - 1]?.id ?? '';
    }

    if (initial) {
      if (initialSessionIdRef.current) {
        if (activeIdRef.current == null) setActiveId(initialSessionIdRef.current);
        return initialSessionIdRef.current;
      }
      const existing = current.find(s => s.name === '');
      if (existing) {
        if (activeIdRef.current == null) setActiveId(existing.id);
        return existing.id;
      }
    }

    if (!initial) {
      const unnamedTab = current.find(s => s.name === 'New');
      if (unnamedTab) {
        setActiveId(unnamedTab.id);
        return unnamedTab.id;
      }
    }

    const id = crypto.randomUUID();
    const name = initial ? '' : 'New';
    const newEntry: SessionEntry = { id, name, status: 'connecting', cwd, createdAt: Date.now() };

    if (initial) initialSessionIdRef.current = id;
    setSessions(prev => [...prev, newEntry]);
    setActiveId(id);
    return id;
  }, []);

  const close = useCallback((id: string) => {
    const current = sessionsRef.current;
    const session = current.find(s => s.id === id);
    if (!session) return;

    const persistedStatus: 'done' | 'error' = session.status === 'error' ? 'error' : 'done';
    const persistedEntry: PersistedSession = {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: persistedStatus,
      closedAt: Date.now(),
    };
    saveToHistory(session.cwd, persistedEntry);
    setHistory(h => [persistedEntry, ...h].slice(0, MAX_HISTORY));

    const remaining = current.filter(s => s.id !== id);
    setSessions(remaining);

    if (activeIdRef.current === id) {
      setActiveId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateName = useCallback((id: string, name: string) => {
    if (namedSessionsRef.current.has(id)) return;
    namedSessionsRef.current.add(id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    setHasPrompted(true);
  }, []);

  const updateStatus = useCallback((id: string, status: SessionStatus) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  return {
    sessions,
    activeId,
    hasPrompted,
    spawn,
    close,
    setActive,
    updateName,
    updateStatus,
    history,
    restoreForCwd,
  };
}
