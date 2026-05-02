import { useCallback, useEffect, useState, type FC } from 'react';

interface LiveCanvasPayload {
  html: string | null;
  mtimeMs: number | null;
  relPath: string;
  oversize?: boolean;
}

interface LiveCanvasPanelProps {
  cwd: string;
}

/** Sandboxed iframe: scripts run for charts/DOM viz but cannot reach the SlopMop parent app. */
const IFRAME_SANDBOX = 'allow-scripts allow-forms';

export const LiveCanvasPanel: FC<LiveCanvasPanelProps> = ({ cwd }) => {
  const [payload, setPayload] = useState<LiveCanvasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-canvas?cwd=${encodeURIComponent(cwd)}`);
      const data = (await res.json()) as LiveCanvasPayload & { error?: string };
      if (!res.ok) {
        setErr(data.error ?? res.statusText);
        setPayload(null);
        return;
      }
      setErr(null);
      setPayload({
        html: data.html ?? null,
        mtimeMs: data.mtimeMs ?? null,
        relPath: data.relPath ?? '.slop/live-canvas.html',
        oversize: data.oversize,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !payload) {
    return <div className="live-canvas-panel live-canvas-panel--loading">Loading Live Canvas…</div>;
  }

  const hasHtml = !!(payload?.html && payload.html.trim());
  const iframeKey = payload?.mtimeMs != null ? String(payload.mtimeMs) : 'none';

  return (
    <div className="live-canvas-panel">
      <div className="live-canvas-toolbar">
        <span className="live-canvas-title">Live Canvas</span>
        <button type="button" className="live-canvas-refresh fp-btn" onClick={() => void load()} title="Refresh now">
          Refresh
        </button>
      </div>
      <p className="live-canvas-hint">
        Full HTML document at <code className="live-canvas-code">{payload?.relPath ?? '.slop/live-canvas.html'}</code>
        — rewrite from the agent or <code className="live-canvas-code">PUT /api/live-canvas</code>. Polls every 2s.
      </p>
      {err && <div className="live-canvas-error">{err}</div>}
      {payload?.oversize && (
        <div className="live-canvas-error">
          File exceeds size limit; shrink <code className="live-canvas-code">.slop/live-canvas.html</code> to under ~2MB.
        </div>
      )}
      {!hasHtml && !payload?.oversize ? (
        <div className="live-canvas-empty">
          <p>No canvas yet.</p>
          <p className="live-canvas-empty-sub">
            Ask Claude to write a complete HTML page (including <code className="live-canvas-code">&lt;!DOCTYPE html&gt;</code>) to{' '}
            <code className="live-canvas-code">.slop/live-canvas.html</code> for dashboards, tables, charts, or diagrams.
          </p>
        </div>
      ) : hasHtml ? (
        <div className="live-canvas-frame-wrap">
          <iframe
            key={iframeKey}
            title="Live Canvas"
            className="live-canvas-iframe"
            sandbox={IFRAME_SANDBOX}
            srcDoc={payload!.html!}
          />
        </div>
      ) : null}
    </div>
  );
};
