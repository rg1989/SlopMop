import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { resolveProjectFolderName, shellSingleQuotedPath } from '../server/project-resolve.js';
import { parseTelegramProjectLine } from '../server/telegram-transport.js';

describe('resolveProjectFolderName', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = path.join(os.tmpdir(), `slopmop-pr-${process.hrtime.bigint()}`);
    await mkdir(tmp, { recursive: true });
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('resolves direct child under root', async () => {
    await mkdir(path.join(tmp, 'MyApp'), { recursive: true });
    const r = await resolveProjectFolderName('MyApp', [tmp], 4);
    expect(r).toEqual({ ok: true, absolutePath: path.join(tmp, 'MyApp') });
  });

  it('resolves nested folder name', async () => {
    await mkdir(path.join(tmp, 'a', 'b', 'MyApp'), { recursive: true });
    const r = await resolveProjectFolderName('MyApp', [tmp], 8);
    expect(r).toEqual({ ok: true, absolutePath: path.join(tmp, 'a', 'b', 'MyApp') });
  });

  it('rejects ambiguous duplicate names', async () => {
    await mkdir(path.join(tmp, 'x', 'dup'), { recursive: true });
    await mkdir(path.join(tmp, 'y', 'dup'), { recursive: true });
    const r = await resolveProjectFolderName('dup', [tmp], 8);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Ambiguous');
  });

  it('rejects path-like names', async () => {
    const r = await resolveProjectFolderName('../x', [tmp], 4);
    expect(r.ok).toBe(false);
  });
});

describe('shellSingleQuotedPath', () => {
  it('wraps simple paths', () => {
    expect(shellSingleQuotedPath('/tmp/foo')).toBe("'/tmp/foo'");
  });
  it('escapes single quotes', () => {
    const q = shellSingleQuotedPath("/tmp/foo'bar");
    expect(q.startsWith("'")).toBe(true);
    expect(q.endsWith("'")).toBe(true);
    expect(q).toContain("foo");
    expect(q).toContain("bar");
  });
});

describe('parseTelegramProjectLine', () => {
  it('parses PROJECT=name', () => {
    expect(parseTelegramProjectLine('PROJECT=myapp\n\nhello')).toEqual({
      project: 'myapp',
      body: 'hello',
    });
  });
  it('parses PROJECT: name', () => {
    expect(parseTelegramProjectLine('PROJECT: myapp\nhi')).toEqual({ project: 'myapp', body: 'hi' });
  });
  it('returns body only when no project line', () => {
    expect(parseTelegramProjectLine('just text')).toEqual({ body: 'just text' });
  });
});
