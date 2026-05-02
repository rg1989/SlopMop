import { useRef, useState, useEffect, useCallback } from 'react';
import type { SessionEntry, SessionStatus } from '../hooks/useSessionManager';

export interface SessionTabBarProps {
  sessions: SessionEntry[];
  activeId: string | null;
  canSpawn: boolean;
  onSetActive: (id: string) => void;
  onClose: (id: string) => void;
  onSpawn: () => void;
  onOpenHistory: () => void;
}

const STATUS_CLASS: Record<SessionStatus, string> = {
  connecting:   'status--connecting',
  reconnecting: 'status--reconnecting',
  waiting:      'status--waiting',
  working:      'status--working',
  done:         'status--done',
  error:        'status--error',
};

export function SessionTabBar({ sessions, activeId, canSpawn, onSetActive, onClose, onSpawn, onOpenHistory }: SessionTabBarProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = tabListRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => { updateScrollState(); }, [sessions, updateScrollState]);

  const showTabs = sessions.length > 1;

  function scrollLeft() { tabListRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); }
  function scrollRight() { tabListRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); }

  return (
    <div className={`session-tab-bar${showTabs ? '' : ' session-tab-bar--solo'}`}>
      {showTabs && (
        <button className="tab-scroll-btn left" onClick={scrollLeft} disabled={!canScrollLeft} aria-label="Scroll tabs left">‹</button>
      )}
      {showTabs && (
        <div className="tab-list" ref={tabListRef}>
          {sessions.map((session) => {
            const isActive = session.id === activeId;
            const tabClass = ['session-tab', isActive ? 'active' : ''].filter(Boolean).join(' ');
            return (
              <div
                key={session.id}
                className={tabClass}
                data-session-id={session.id}
                onClick={() => onSetActive(session.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) { e.preventDefault(); onClose(session.id); }
                }}
              >
                <span className={`status-chip ${STATUS_CLASS[session.status]}`} />
                <span className="tab-title">{session.name || 'New'}</span>
                <button
                  className="tab-close"
                  data-close
                  onClick={(e) => { e.stopPropagation(); onClose(session.id); }}
                  aria-label={`Close ${session.name || 'New'}`}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
      {showTabs && (
        <button className="tab-scroll-btn right" onClick={scrollRight} disabled={!canScrollRight} aria-label="Scroll tabs right">›</button>
      )}
      <div className="session-tab-actions">
        <button
          className="session-spawn-btn"
          onClick={onSpawn}
          disabled={!canSpawn}
          aria-label="New session"
          title={canSpawn ? 'New session' : 'Send a message first to unlock new sessions'}
        >+</button>
        <button
          className="session-history-btn"
          onClick={onOpenHistory}
          aria-label="Session history"
          title="Session history"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
