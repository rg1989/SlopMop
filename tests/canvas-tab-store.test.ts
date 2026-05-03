// @ts-expect-error — module not yet created (RED phase)
import { createTab, updateTab, lockTab, unlockTab, closeTab, getTab, getAllTabs, initCanvasStore } from '../server/canvas-tab-store.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { mkdtemp, readFile } from 'fs/promises';

vi.mock('../server/canvas-tab-sse.js', () => ({
  notifyCanvasTabsUpdated: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTab', () => {
  it('returns a CanvasTab with UUID, empty html, locked=false', async () => {
    const tab = createTab('My Tab');
    expect(tab).not.toBeNull();
    if (!tab) return;
    expect(tab.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tab.title).toBe('My Tab');
    expect(tab.html).toBe('');
    expect(tab.locked).toBe(false);
    expect(tab.lockReason).toBeUndefined();
    expect(typeof tab.createdAt).toBe('number');
    expect(typeof tab.updatedAt).toBe('number');
  });

  it('returns null when tab limit (20) is reached', () => {
    const tabs = getAllTabs();
    const needed = 20 - tabs.length;
    const created: string[] = [];
    for (let i = 0; i < needed; i++) {
      const t = createTab(`tab ${i}`);
      if (t) created.push(t.id);
    }
    const over = createTab('one too many');
    expect(over).toBeNull();
    created.forEach(id => closeTab(id));
  });
});

describe('updateTab', () => {
  it('wraps body-only html in full document template', () => {
    const tab = createTab('test');
    if (!tab) throw new Error('createTab returned null');
    updateTab(tab.id, '<p>Hello</p>');
    const updated = getTab(tab.id);
    expect(updated?.html).toContain('<!DOCTYPE html>');
    expect(updated?.html).toContain('<p>Hello</p>');
    expect(updated?.html).toContain('--bg:');
    expect(updated?.html).toContain('--accent:');
    expect(updated?.html).toContain('.canvas-card');
    closeTab(tab.id);
  });

  it('passes through full DOCTYPE document unchanged', () => {
    const tab = createTab('test');
    if (!tab) throw new Error('createTab returned null');
    const full = '<!DOCTYPE html><html><body>hi</body></html>';
    updateTab(tab.id, full);
    const updated = getTab(tab.id);
    expect(updated?.html).toBe(full);
    closeTab(tab.id);
  });

  it('passes through html-tag documents unchanged', () => {
    const tab = createTab('test');
    if (!tab) throw new Error('createTab returned null');
    const full = '<html><body>hi</body></html>';
    updateTab(tab.id, full);
    const updated = getTab(tab.id);
    expect(updated?.html).toBe(full);
    closeTab(tab.id);
  });

  it('handles leading whitespace before DOCTYPE detection', () => {
    const tab = createTab('test');
    if (!tab) throw new Error('createTab returned null');
    const full = '  \n<!DOCTYPE html><html><body>hi</body></html>';
    updateTab(tab.id, full);
    const updated = getTab(tab.id);
    expect(updated?.html).toBe(full);
    closeTab(tab.id);
  });
});

describe('lockTab / unlockTab', () => {
  it('sets locked=true with optional reason', () => {
    const tab = createTab('lock-test');
    if (!tab) throw new Error('createTab returned null');
    lockTab(tab.id, 'mcp-tool');
    const locked = getTab(tab.id);
    expect(locked?.locked).toBe(true);
    expect(locked?.lockReason).toBe('mcp-tool');
    closeTab(tab.id);
  });

  it('unlockTab clears locked and lockReason', () => {
    const tab = createTab('unlock-test');
    if (!tab) throw new Error('createTab returned null');
    lockTab(tab.id);
    unlockTab(tab.id);
    const unlocked = getTab(tab.id);
    expect(unlocked?.locked).toBe(false);
    expect(unlocked?.lockReason).toBeUndefined();
    closeTab(tab.id);
  });
});

describe('closeTab', () => {
  it('removes tab so getTab returns undefined', () => {
    const tab = createTab('close-test');
    if (!tab) throw new Error('createTab returned null');
    const { id } = tab;
    closeTab(id);
    expect(getTab(id)).toBeUndefined();
  });
});

describe('getAllTabs', () => {
  it('returns array of all current tabs', () => {
    const before = getAllTabs().length;
    const tab = createTab('list-test');
    if (!tab) throw new Error('createTab returned null');
    const after = getAllTabs();
    expect(after.length).toBe(before + 1);
    expect(after.some(t => t.id === tab.id)).toBe(true);
    closeTab(tab.id);
  });
});

describe('initCanvasStore', () => {
  it('loads tabs from canvas-state.json when file exists', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'canvas-test-'));
    const slopDir = path.join(tmpDir, '.slop');
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(slopDir, { recursive: true });
    const existingTab = {
      id: 'test-uuid-1234',
      title: 'Loaded Tab',
      html: '<p>loaded</p>',
      locked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await writeFile(path.join(slopDir, 'canvas-state.json'), JSON.stringify([existingTab]));
    await initCanvasStore(tmpDir);
    const tab = getTab('test-uuid-1234');
    expect(tab).toBeDefined();
    expect(tab?.title).toBe('Loaded Tab');
    closeTab('test-uuid-1234');
  });

  it('handles missing canvas-state.json gracefully', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'canvas-empty-'));
    await expect(initCanvasStore(tmpDir)).resolves.not.toThrow();
  });
});
