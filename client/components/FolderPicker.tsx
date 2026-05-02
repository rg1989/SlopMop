import { useState, useEffect, useRef } from 'react';

const RECENT_PATHS_KEY = 'slopmop_recent_paths';
const MAX_RECENT = 10;

function getRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PATHS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function addRecentPath(path: string): string[] {
  const current = getRecentPaths();
  const deduped = current.filter(p => p !== path);
  const updated = [path, ...deduped].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

function removeRecentPath(path: string): string[] {
  const updated = getRecentPaths().filter(p => p !== path);
  try { localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

function pathParts(p: string) {
  const parts = p.split('/').filter(Boolean);
  const name = parts[parts.length - 1] ?? '';
  const parent = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') + '/' : '/';
  return { name, parent };
}

interface FolderPickerProps {
  cwd: string | null;
  onConnect: (path: string) => void;
  onSettingsOpen?: () => void;
  onSuperToolsOpen?: () => void;
  onRulesOpen?: () => void;
  onCanvasToggle?: () => void;
  isCanvasVisible?: boolean;
}

export function FolderPicker({ cwd, onConnect, onSettingsOpen, onSuperToolsOpen, onRulesOpen, onCanvasToggle, isCanvasVisible }: FolderPickerProps) {
  const [picking, setPicking] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentPaths, setRecentPaths] = useState<string[]>(getRecentPaths);

  const branchDropRef = useRef<HTMLDivElement>(null);
  const recentDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/recent-paths')
      .then(r => r.json())
      .then(({ paths }: { paths: string[] }) => {
        if (paths.length > 0) setRecentPaths(paths);
      })
      .catch(() => {});
  }, []);

  // Track this cwd in recent paths
  useEffect(() => {
    if (!cwd) return;
    const updated = addRecentPath(cwd);
    setRecentPaths(updated);
    fetch('/api/recent-paths', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: updated }),
    }).catch(() => {});
  }, [cwd]);

  // Fetch current branch
  useEffect(() => {
    if (!cwd) { setBranch(null); setBranches([]); return; }
    fetch(`/api/git-branch?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ branch }: { branch: string | null }) => setBranch(branch))
      .catch(() => setBranch(null));
  }, [cwd]);

  // Fetch branch list when open
  useEffect(() => {
    if (!branchOpen || !cwd) return;
    fetch(`/api/git-branches?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(({ branches }: { branches: string[] }) => setBranches(branches))
      .catch(() => setBranches([]));
  }, [branchOpen, cwd]);

  // Click-outside for branch dropdown
  useEffect(() => {
    if (!branchOpen) return;
    const handler = (e: MouseEvent) => {
      if (branchDropRef.current && !branchDropRef.current.contains(e.target as Node)) setBranchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [branchOpen]);

  // Click-outside for recent dropdown
  useEffect(() => {
    if (!recentOpen) return;
    const handler = (e: MouseEvent) => {
      if (recentDropRef.current && !recentDropRef.current.contains(e.target as Node)) setRecentOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [recentOpen]);

  const handleBrowse = async () => {
    setPicking(true);
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' });
      if (res.ok) {
        const { path: selected } = await res.json() as { path: string };
        onConnect(selected);
      }
    } finally {
      setPicking(false);
    }
  };

  const handleCheckout = async (b: string) => {
    if (!cwd) return;
    setBranchOpen(false);
    const res = await fetch('/api/git-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd, branch: b }),
    });
    const { ok } = await res.json() as { ok: boolean };
    if (ok) setBranch(b);
  };

  const handleSelectRecent = (path: string) => {
    setRecentOpen(false);
    if (path !== cwd) onConnect(path);
  };

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const updated = removeRecentPath(path);
    setRecentPaths(updated);
    fetch('/api/recent-paths', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: updated }),
    }).catch(() => {});
  };

  const { name: folderName, parent: parentPath } = cwd ? pathParts(cwd) : { name: '', parent: '' };

  return (
    <div className="fp-bar">
      <div className="fp-recent-wrap" ref={recentDropRef}>
        <button
          type="button"
          className={`fp-path-display fp-path-btn${recentOpen ? ' open' : ''}`}
          onClick={() => setRecentOpen(o => !o)}
          title="Recent folders"
        >
          <svg className="fp-path-home-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="fp-path-text">
            {cwd ? (
              <>
                <span className="fp-path-parent">{parentPath}</span>
                <span className="fp-path-name">{folderName}</span>
              </>
            ) : (
              <span className="fp-path-placeholder">No folder open</span>
            )}
          </span>
          <svg className="fp-path-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {recentOpen && (
          <div className="fp-recent-dropdown">
            <div className="fp-recent-header">Recent Folders</div>
            {recentPaths.length === 0 ? (
              <div className="fp-recent-empty">No recent folders</div>
            ) : recentPaths.map(p => {
              const { name, parent } = pathParts(p);
              const isActive = p === cwd;
              return (
                <button
                  key={p}
                  type="button"
                  className={`fp-recent-item${isActive ? ' active' : ''}`}
                  onClick={() => handleSelectRecent(p)}
                >
                  <span className="fp-recent-item-check">
                    {isActive && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span className="fp-recent-item-text">
                    <span className="fp-recent-item-name">{name}</span>
                    <span className="fp-recent-item-parent">{parent}</span>
                  </span>
                  <span
                    className="fp-recent-item-remove"
                    role="button"
                    aria-label="Remove from recent"
                    onClick={e => handleRemoveRecent(e, p)}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </span>
                </button>
              );
            })}
            <div className="fp-recent-divider" />
            <button type="button" className="fp-recent-browse" onClick={() => { setRecentOpen(false); handleBrowse(); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Browse…
            </button>
          </div>
        )}
      </div>

      <div className="fp-logo">
        <span className="fp-logo-slop">SLOP</span>
        <img src="/mop.png" className="fp-logo-mop-img" alt="" draggable={false} />
        <span className="fp-logo-mop">MOP</span>
      </div>

      <div className="fp-right">
        {branch && (
          <div className="fp-branch-wrap" ref={branchDropRef}>
            <button className="fp-branch-btn" onClick={() => setBranchOpen(o => !o)} title="Switch git branch">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"/>
                <circle cx="18" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/>
                <path d="M18 9a9 9 0 0 1-9 9"/>
              </svg>
              <span>{branch}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {branchOpen && (
              <div className="fp-branch-dropdown">
                {branches.length === 0 ? (
                  <div className="fp-branch-item" style={{ color: '#484f58', cursor: 'default' }}>Loading…</div>
                ) : branches.map(b => (
                  <div
                    key={b}
                    className={`fp-branch-item${b === branch ? ' active' : ''}`}
                    onClick={() => handleCheckout(b)}
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {cwd && onSuperToolsOpen && (
          <button className="fp-supertools-btn" onClick={onSuperToolsOpen} title="Super Tools">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </button>
        )}

        {onCanvasToggle && (
          <button
            className={`fp-canvas-btn${isCanvasVisible ? ' fp-canvas-btn--active' : ''}`}
            onClick={onCanvasToggle}
            title={isCanvasVisible ? 'Hide canvas' : 'Show canvas'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M9 9h6v6H9z"/>
            </svg>
          </button>
        )}

        {onRulesOpen && (
          <button className="fp-rules-btn" onClick={onRulesOpen} title="Rules">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="16" y2="17"/>
              <line x1="8" y1="9" x2="10" y2="9"/>
            </svg>
          </button>
        )}

        {onSettingsOpen && (
          <button className="fp-settings-btn" onClick={onSettingsOpen} title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
