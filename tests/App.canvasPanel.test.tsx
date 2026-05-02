import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// Mock heavy hooks so App renders without real side effects
vi.mock('../client/hooks/useDragResize', () => ({
  useDragResize: () => ({ width: 240, isDragging: false, onMouseDown: vi.fn(), setWidth: vi.fn() }),
}));

vi.mock('../client/hooks/useSessionManager', () => ({
  useSessionManager: () => ({
    sessions: [],
    activeId: null,
    hasPrompted: false,
    history: [],
    spawn: vi.fn(),
    close: vi.fn(),
    setActive: vi.fn(),
    restoreForCwd: vi.fn(),
  }),
}));

vi.mock('../client/hooks/useFileTree', () => ({
  useFileTree: () => ({
    tree: [],
    changedPaths: [],
    gitStatus: null,
    loadChanges: vi.fn(),
    mode: 'all',
    setMode: vi.fn(),
  }),
}));

vi.mock('../client/hooks/useAudioCoordinator', () => ({
  useAudioCoordinator: () => ({
    tts: { stop: vi.fn(), handleData: vi.fn(), speaking: false },
    voice: { listening: false, start: vi.fn(), stop: vi.fn() },
  }),
}));

vi.mock('../client/hooks/useSettings', async () => {
  const actual = await vi.importActual<typeof import('../client/hooks/useSettings')>('../client/hooks/useSettings');
  return {
    ...actual,
    useSettings: () => ({
      settings: {
        recordingMode: 'toggle',
        pttKey: null,
        sidebarTabsOrientation: 'horizontal',
        showHiddenFiles: true,
        agent: { command: 'claude', args: [], label: 'Claude' },
        typeIndicatorSize: 14,
      },
      update: vi.fn(),
    }),
  };
});

vi.mock('../client/hooks/useProjectHealth', () => ({
  useProjectHealth: () => [],
}));

// Mock child components that depend on browser APIs not available in jsdom
vi.mock('../client/components/SessionPane', () => ({
  SessionPane: () => null,
}));

vi.mock('../client/components/FolderPicker', () => ({
  FolderPicker: ({ onConnect }: { onConnect: (p: string) => void }) => (
    <button data-testid="folder-picker-connect" onClick={() => onConnect('/test/project')}>
      Connect
    </button>
  ),
}));

vi.mock('../client/components/LiveCanvasPanel', () => ({
  LiveCanvasPanel: () => <div data-testid="live-canvas-panel" />,
}));

vi.mock('../client/components/VoiceBar', () => ({
  VoiceBar: () => null,
}));

vi.mock('../client/components/HealthStatusBar', () => ({
  HealthStatusBar: () => null,
}));

vi.mock('../client/components/OnboardingModal', () => ({
  OnboardingModal: () => null,
}));

vi.mock('../client/components/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('../client/components/SuperToolsModal', () => ({
  SuperToolsModal: () => null,
}));

vi.mock('../client/components/RulesModal', () => ({
  RulesModal: () => null,
}));

vi.mock('../client/components/SessionHistoryModal', () => ({
  SessionHistoryModal: () => null,
}));

vi.mock('../client/components/SessionTabBar', () => ({
  SessionTabBar: () => null,
}));

vi.mock('../client/components/GsdRoadmap', () => ({
  GsdRoadmap: () => null,
}));

vi.mock('../client/components/BrainPanel', () => ({
  BrainPanel: () => null,
}));

vi.mock('../client/components/FileTree', () => ({
  FileTree: () => null,
}));

vi.mock('../client/components/SourceControl', () => ({
  SourceControl: () => null,
}));

vi.mock('../client/components/FilePreview', () => ({
  FilePreview: () => null,
}));

vi.mock('../client/components/BrainEntryView', () => ({
  BrainEntryView: () => null,
}));

vi.mock('../client/components/EditorTabBar', () => ({
  EditorTabBar: () => null,
}));

import App from '../client/App';

function setupFetchMock() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/dir-exists')) {
      return Promise.resolve({ json: async () => ({ exists: true }) });
    }
    if (url.includes('/api/slop-status')) {
      return Promise.resolve({ json: async () => ({ exists: true, config: null }) });
    }
    return Promise.resolve({ json: async () => ({}) });
  }));
}

describe('CANVAS-04: sidebar tab count after canvas tab removal', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
  });

  it('sidebar contains exactly 4 tabs (canvas tab removed)', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabsBar = container.querySelector('.sidebar-tabs-bar');
      expect(tabsBar).not.toBeNull();
    });

    const tabsBar = container.querySelector('.sidebar-tabs-bar');
    const stabs = tabsBar?.querySelectorAll('.stab');

    // CANVAS-04: should be 4 tabs (explorer, changes, roadmap, brain) — canvas removed
    // Currently fails RED because SIDEBAR_TABS still has 5 entries
    expect(stabs?.length).toBe(4);
  });

  it('no button with title "Live Canvas" exists in sidebar', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabsBar = container.querySelector('.sidebar-tabs-bar');
      expect(tabsBar).not.toBeNull();
    });

    const canvasBtn = container.querySelector('[title="Live Canvas"]');
    // CANVAS-04: canvas tab button should not exist in sidebar
    expect(canvasBtn).toBeNull();
  });
});

describe('CANVAS-05: canvas column width restored from localStorage', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:canvas_width', JSON.stringify(450));
  });

  it('canvas-column element is present in the document when cwd is set', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const appBody = container.querySelector('.app-body');
      expect(appBody).not.toBeNull();
    });

    // CANVAS-05: a .canvas-column element should exist (rendered outside sidebar)
    // Fails RED because canvas-column does not exist yet in the codebase
    const canvasColumn = container.querySelector('.canvas-column');
    expect(canvasColumn).not.toBeNull();
  });
});
