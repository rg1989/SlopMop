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
}

const HISTORY_KEY = (cwd: string) => `slopdock_sessions_${cwd}`;
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

export function useSessionManager(): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<PersistedSession[]>([]);
  // True once any session has received its first user prompt
  const [hasPrompted, setHasPrompted] = useState(false);

  // Track which sessions have had their name set via updateName (idempotent after first call)
  const namedSessionsRef = useRef<Set<string>>(new Set());
  // Keep a ref to sessions for use inside callbacks without stale closure issues
  const sessionsRef = useRef<SessionEntry[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const initialSessionIdRef = useRef<string | null>(null);

  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Load all session history from localStorage on mount
  useEffect(() => {
    const allHistory: PersistedSession[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('slopdock_sessions_')) {
          const cwd = key.replace('slopdock_sessions_', '');
          allHistory.push(...loadHistory(cwd));
        }
      }
    } catch {}
    allHistory.sort((a, b) => b.closedAt - a.closedAt);
    setHistory(allHistory);
  }, []);

  const spawn = useCallback((cwd: string, { initial = false }: { initial?: boolean } = {}): string => {
    const current = sessionsRef.current;
    if (current.length >= MAX_SESSIONS) {
      return activeIdRef.current ?? current[current.length - 1]?.id ?? '';
    }

    if (initial) {
      if (initialSessionIdRef.current) {
        setActiveId(initialSessionIdRef.current);
        return initialSessionIdRef.current;
      }
      const existing = current.find(s => s.name === '');
      if (existing) {
        setActiveId(existing.id);
        return existing.id;
      }
    }

    // If spawning an additional session, focus existing "New" tab instead of creating another
    if (!initial) {
      const unnamedTab = current.find(s => s.name === 'New');
      if (unnamedTab) {
        setActiveId(unnamedTab.id);
        return unnamedTab.id;
      }
    }

    const id = crypto.randomUUID();
    // Initial session has no name (tab bar hidden while solo); additional sessions start as "New"
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
  };
}
