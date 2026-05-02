import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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

describe('BPANEL-01: bottom-panel-tab-bar always rendered', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
  });

  it('bottom-panel-tab-bar exists when panel is closed by default', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar');
      expect(tabBar).not.toBeNull();
    });
  });
});

describe('BPANEL-02: bottom panel body hidden when closed', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
  });

  it('bottom-panel element not present when closed', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar');
      expect(tabBar).not.toBeNull();
    });

    expect(container.querySelector('.bottom-panel')).toBeNull();
  });
});

describe('BPANEL-03: bottom panel body shown when open', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
  });

  it('clicking toggle opens panel with height style', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar');
      expect(tabBar).not.toBeNull();
    });

    const toggleBtn = container.querySelector('.bottom-panel-toggle-btn') as HTMLElement;
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      const panel = container.querySelector('.bottom-panel') as HTMLElement | null;
      expect(panel).not.toBeNull();
      expect(panel!.style.height).toBeTruthy();
    });
  });
});

describe('BPANEL-04: toggle persists to localStorage', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
  });

  it('toggle writes slopmop_ui:bottom_panel_open to localStorage', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar');
      expect(tabBar).not.toBeNull();
    });

    const toggleBtn = container.querySelector('.bottom-panel-toggle-btn') as HTMLElement;
    fireEvent.click(toggleBtn);

    expect(localStorage.getItem('slopmop_ui:bottom_panel_open')).not.toBeNull();
  });
});

describe('BPANEL-05: panel height restored from localStorage', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_height', JSON.stringify(300));
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
  });

  it('panel opens with restored height from localStorage', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const panel = container.querySelector('.bottom-panel') as HTMLElement | null;
      expect(panel).not.toBeNull();
      expect(panel!.style.height).toBe('300px');
    });
  });
});
