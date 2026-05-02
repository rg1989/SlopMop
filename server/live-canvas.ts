import path from 'path';
import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises';
import { notifyLiveCanvasUpdated } from './live-canvas-sse.js';

/** Relative to project root; agent or REST PUT writes here. */
export const LIVE_CANVAS_REL_PARTS = ['.slop', 'live-canvas.html'] as const;

export const LIVE_CANVAS_MAX_BYTES = 2_000_000;

export function resolveLiveCanvasAbsPath(projectRoot: string): string {
  const resolved = path.resolve(projectRoot);
  const abs = path.resolve(resolved, ...LIVE_CANVAS_REL_PARTS);
  const prefix = resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
  if (abs !== resolved && !abs.startsWith(prefix)) {
    throw new Error('Path outside cwd');
  }
  return abs;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

export async function readLiveCanvas(
  projectRoot: string,
): Promise<{ html: string | null; mtimeMs: number | null; relPath: string; oversize?: boolean }> {
  const abs = resolveLiveCanvasAbsPath(projectRoot);
  const relPath = path.join(...LIVE_CANVAS_REL_PARTS);
  try {
    const st = await stat(abs);
    const buf = await readFile(abs);
    if (buf.length > LIVE_CANVAS_MAX_BYTES) {
      return {
        html: null,
        mtimeMs: st.mtimeMs,
        relPath,
        oversize: true,
      };
    }
    return {
      html: buf.toString('utf-8'),
      mtimeMs: st.mtimeMs,
      relPath,
    };
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { html: null, mtimeMs: null, relPath };
    }
    throw e;
  }
}

export async function writeLiveCanvas(
  projectRoot: string,
  html: string,
): Promise<{ relPath: string; mtimeMs: number }> {
  if (typeof html !== 'string') {
    throw new Error('html must be a string');
  }
  const buf = Buffer.byteLength(html, 'utf-8');
  if (buf > LIVE_CANVAS_MAX_BYTES) {
    throw new Error(`live canvas exceeds ${LIVE_CANVAS_MAX_BYTES} bytes`);
  }
  const resolved = path.resolve(projectRoot);
  const abs = resolveLiveCanvasAbsPath(resolved);
  await mkdir(path.dirname(abs), { recursive: true });
  await atomicWrite(abs, html);
  const st = await stat(abs);
  notifyLiveCanvasUpdated(resolved, st.mtimeMs);
  return { relPath: path.join(...LIVE_CANVAS_REL_PARTS), mtimeMs: st.mtimeMs };
}
