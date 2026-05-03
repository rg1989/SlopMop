import { useState, useEffect } from 'react';

interface McpServer {
  command: string;
  args: string[];
  status: 'active' | 'registered';
}

interface McpConnectionsModalProps {
  onClose: () => void;
}

export function McpConnectionsModal({ onClose }: McpConnectionsModalProps) {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/mcp-servers');
    const data = await r.json();
    setServers(data.servers ?? {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleRemove = async (name: string) => {
    setRemoving(name);
    await fetch(`/api/mcp-remove/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await load();
    setRemoving(null);
  };

  const handleRegister = async () => {
    setRegistering(true);
    await fetch('/api/mcp-register-canvas', { method: 'POST' });
    await load();
    setRegistering(false);
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div className="modal-panel modal-panel--settings-wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <span className="modal-title">MCP Connections</span>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && <div className="mcp-loading">Loading...</div>}
          {!loading && Object.keys(servers).length === 0 && (
            <div style={{ color: 'var(--txt-sub)', fontSize: 12 }}>No MCP servers registered.</div>
          )}
          {!loading && Object.entries(servers).map(([name, srv]) => (
            <div key={name} className="mcp-server-row">
              <span className={`mcp-status-dot mcp-status-dot--${srv.status}`} />
              <span className="mcp-server-name">{name}</span>
              <span className="mcp-server-cmd">{srv.command} {srv.args?.join(' ')}</span>
              <button
                className="mcp-remove-btn"
                onClick={() => handleRemove(name)}
                disabled={removing === name}
                title="Remove"
              >
                {removing === name ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          {!loading && !servers['slopmop-canvas'] && (
            <button className="fp-btn" onClick={handleRegister} disabled={registering}>
              {registering ? 'Registering…' : 'Auto-register slopmop-canvas'}
            </button>
          )}
          <button className="fp-btn primary" onClick={onClose} style={{ marginLeft: 'auto' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
