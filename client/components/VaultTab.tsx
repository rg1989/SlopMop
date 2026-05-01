import { useState, useEffect, type FC } from 'react';

function toRelPath(p: string): string {
  const home = (globalThis as Record<string, unknown>).__home as string | undefined;
  if (home && p.startsWith(home)) return '~' + p.slice(home.length);
  // Fallback: strip common macOS home prefix pattern
  return p.replace(/^\/Users\/[^/]+/, '~');
}

interface VaultTarget {
  id: string;
  src: string;
  dest: string;
  sourceExists: boolean;
  backupExists: boolean;
  inSync: boolean;
  lastBackup: string | null;
}

function dotClass(t: VaultTarget): string {
  if (!t.sourceExists) return 'vault-dot vault-dot--grey';
  if (!t.backupExists || !t.inSync) return 'vault-dot vault-dot--warn';
  return 'vault-dot vault-dot--ok';
}

export const VaultTab: FC = () => {
  const [targets, setTargets] = useState<VaultTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const r = await fetch('/api/vault-status');
      const data = await r.json() as { targets: VaultTarget[] };
      setTargets(data.targets ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function backupAll() {
    setBusy(true);
    try {
      await fetch('/api/vault-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetchStatus();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  async function backupOne(id: string) {
    setBusy(true);
    try {
      await fetch('/api/vault-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: [id] }),
      });
      await fetchStatus();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  async function restoreOne(id: string) {
    setBusy(true);
    try {
      await fetch('/api/vault-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: [id] }),
      });
      await fetchStatus();
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vault-tab">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--txt-sub)' }}>
          {loading ? 'Loading…' : `${targets.length} backup targets`}
        </span>
        <button
          className="fp-btn"
          onClick={backupAll}
          disabled={busy || loading}
        >
          Backup All
        </button>
      </div>

      <div>
        {targets.map(t => (
          <div key={t.id} className="vault-row">
            <div className="vault-row-top">
              <span className={dotClass(t)} />
              <span className="vault-row-label">{t.id}</span>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                <button
                  className="fp-btn"
                  onClick={() => backupOne(t.id)}
                  disabled={busy || !t.sourceExists}
                >
                  Backup
                </button>
                <button
                  className="fp-btn"
                  onClick={() => restoreOne(t.id)}
                  disabled={busy || !t.backupExists}
                >
                  Restore
                </button>
              </div>
            </div>
            <div className="vault-row-meta">
              <div className="vault-row-path">{toRelPath(t.src)}</div>
              <div className="vault-row-ts">
                {t.lastBackup ? new Date(t.lastBackup).toLocaleString() : 'never backed up'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--txt-dim)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <strong style={{ color: 'var(--txt-sub)' }}>Tip:</strong> make ~/.slop/ a private git repo to sync configs across machines:<br />
        <code style={{ color: 'var(--accent)', fontSize: 11 }}>cd ~/.slop && git init && git add -A && git commit -m "init"</code>
      </div>
    </div>
  );
};
