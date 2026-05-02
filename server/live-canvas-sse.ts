import type { Request, Response } from 'express';
import path from 'path';

type Client = { cwdNorm: string; res: Response };

const clients = new Set<Client>();

function normCwd(cwd: string): string {
  return path.resolve(cwd);
}

/**
 * Register an SSE client; sends optional initial event, then future `notify` lines.
 */
export function registerLiveCanvasSseClient(cwd: string, req: Request, res: Response, initialMtime: number | null): void {
  const cwdNorm = normCwd(cwd);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const entry: Client = { cwdNorm, res };
  clients.add(entry);

  const payload = (mtimeMs: number | null, extra?: Record<string, unknown>) => {
    const line = JSON.stringify({ cwd: cwdNorm, mtimeMs, ...extra });
    res.write(`data: ${line}\n\n`);
  };

  payload(initialMtime, { connected: true });

  const detach = () => {
    clients.delete(entry);
  };
  req.on('close', detach);
  res.on('close', detach);
}

/** Call after live canvas file changes (same resolved project root as GET). */
export function notifyLiveCanvasUpdated(projectRoot: string, mtimeMs: number | null): void {
  const cwdNorm = normCwd(projectRoot);
  const line = `data: ${JSON.stringify({ cwd: cwdNorm, mtimeMs })}\n\n`;
  for (const c of clients) {
    if (c.cwdNorm !== cwdNorm) continue;
    if (c.res.writableEnded) {
      clients.delete(c);
      continue;
    }
    try {
      c.res.write(line);
    } catch {
      clients.delete(c);
    }
  }
}

export function isProjectRelativeLiveCanvasPath(relPath: string): boolean {
  const n = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return n === '.slop/live-canvas.html';
}
