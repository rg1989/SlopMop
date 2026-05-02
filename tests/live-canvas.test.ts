import { describe, it, expect } from 'vitest';
import path from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import {
  resolveLiveCanvasAbsPath,
  readLiveCanvas,
  writeLiveCanvas,
  LIVE_CANVAS_MAX_BYTES,
} from '../server/live-canvas.js';

describe('live-canvas', () => {
  it('resolveLiveCanvasAbsPath stays under project root', () => {
    const root = path.join(os.tmpdir(), 'lc-test-root');
    const abs = resolveLiveCanvasAbsPath(root);
    expect(abs).toBe(path.join(path.resolve(root), '.slop', 'live-canvas.html'));
  });

  it('write then read roundtrip', async () => {
    const root = path.join(os.tmpdir(), `lc-rt-${process.hrtime.bigint()}`);
    await mkdir(root, { recursive: true });
    try {
      const html = '<!DOCTYPE html><html><body><p>hi</p></body></html>';
      await writeLiveCanvas(root, html);
      const r = await readLiveCanvas(root);
      expect(r.html).toBe(html);
      expect(r.mtimeMs).toBeTypeOf('number');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('write rejects oversized payload', async () => {
    const root = path.join(os.tmpdir(), `lc-big-${process.hrtime.bigint()}`);
    await mkdir(root, { recursive: true });
    try {
      const huge = 'x'.repeat(LIVE_CANVAS_MAX_BYTES + 1);
      await expect(writeLiveCanvas(root, huge)).rejects.toThrow(/exceeds/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('read returns oversize when file on disk is too large', async () => {
    const root = path.join(os.tmpdir(), `lc-oversize-${process.hrtime.bigint()}`);
    await mkdir(path.join(root, '.slop'), { recursive: true });
    const abs = path.join(root, '.slop', 'live-canvas.html');
    try {
      await writeFile(abs, Buffer.alloc(LIVE_CANVAS_MAX_BYTES + 1, 97));
      const r = await readLiveCanvas(root);
      expect(r.oversize).toBe(true);
      expect(r.html).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
