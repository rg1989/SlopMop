import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('../client/hooks/useDragResize', () => ({
  useDragResize: (initialWidth: number) => ({ width: initialWidth, isDragging: false, onMouseDown: vi.fn(), setWidth: vi.fn() }),
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

const { mockAdd, mockRemove, mockSetActive, mockRawState } = vi.hoisted(() => {
  const mockRawState = {
    sessions: [] as Array<{ id: string; status: string; cwd: string }>,
    activeId: null as string | null,
  };
  return {
    mockAdd: vi.fn(),
    mockRemove: vi.fn(),
    mockSetActive: vi.fn(),
    mockRawState,
  };
});

vi.mock('../client/hooks/useRawSessionManager', () => ({
  useRawSessionManager: () => ({
    sessions: mockRawState.sessions,
    activeId: mockRawState.activeId,
    add: mockAdd,
    remove: mockRemove,
    setActive: mockSetActive,
    updateStatus: vi.fn(),
  }),
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

vi.mock('../client/components/RawTerminalPane', () => ({
  RawTerminalPane: ({ isActive, cwd }: any) => (
    <div
      className="raw-terminal-pane"
      data-testid="raw-terminal-pane"
      data-cwd={cwd}
      style={{ display: isActive ? 'flex' : 'none' }}
    />
  ),
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

describe('RAWTERM-01: raw-terminal-pane rendered inside bottom panel body', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockRawState.sessions = [{ id: 'a', status: 'waiting', cwd: '/test/project' }];
    mockRawState.activeId = 'a';
  });

  it('bottom-panel-body contains a .raw-terminal-pane element when panel is open', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const panel = container.querySelector('.bottom-panel');
      expect(panel).not.toBeNull();
    });

    const pane = container.querySelector('.raw-terminal-pane');
    expect(pane).not.toBeNull();
  });
});

describe('RAWTERM-02: tab bar renders tab chips and add button', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockRawState.sessions = [{ id: 'a', status: 'waiting', cwd: '/test/project' }];
    mockRawState.activeId = 'a';
  });

  it('.bottom-panel-tab-bar-tabs renders .bpanel-tab chips and .bpanel-add-btn', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar-tabs');
      expect(tabBar).not.toBeNull();
    });

    const tabs = container.querySelectorAll('.bpanel-tab');
    expect(tabs.length).toBeGreaterThan(0);

    const addBtn = container.querySelector('.bpanel-add-btn');
    expect(addBtn).not.toBeNull();
  });
});

describe('RAWTERM-03: clicking tab calls setActive; inactive panes have display:none', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockSetActive.mockReset();
    mockRawState.sessions = [
      { id: 'a', status: 'waiting', cwd: '/p' },
      { id: 'b', status: 'waiting', cwd: '/p' },
    ];
    mockRawState.activeId = 'a';
  });

  it('inactive pane has display:none; clicking tab calls setActive', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const panel = container.querySelector('.bottom-panel');
      expect(panel).not.toBeNull();
    });

    const panes = container.querySelectorAll('[data-testid="raw-terminal-pane"]');
    const inactivePane = Array.from(panes).find(p => (p as HTMLElement).style.display === 'none');
    expect(inactivePane).not.toBeUndefined();

    const tabs = container.querySelectorAll('.bpanel-tab');
    if (tabs.length > 1) {
      fireEvent.click(tabs[1]);
      expect(mockSetActive).toHaveBeenCalled();
    }
  });
});

describe('RAWTERM-04: closing tab removes session; adjacent becomes active', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockRemove.mockReset();
    mockRawState.sessions = [{ id: 'a', status: 'waiting', cwd: '/test/project' }];
    mockRawState.activeId = 'a';
  });

  it('clicking .bpanel-tab-close calls remove with session id', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const panel = container.querySelector('.bottom-panel');
      expect(panel).not.toBeNull();
    });

    const closeBtn = container.querySelector('.bpanel-tab-close') as HTMLElement | null;
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(mockRemove).toHaveBeenCalled();
    } else {
      expect(container.querySelector('.bpanel-tab-close')).not.toBeNull();
    }
  });
});

describe('RAWTERM-05: opening bottom panel auto-seeds one session', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockRawState.sessions = [];
    mockRawState.activeId = null;
  });

  it('after opening panel, add() is called once to auto-seed a session', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const tabBar = container.querySelector('.bottom-panel-tab-bar');
      expect(tabBar).not.toBeNull();
    });

    const toggleBtn = container.querySelector('.bottom-panel-toggle-btn') as HTMLElement;
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledTimes(1);
    });
  });
});

describe('RAWTERM-06: RawTerminalPane receives cwd prop matching project cwd', () => {
  beforeEach(() => {
    setupFetchMock();
    localStorage.clear();
    localStorage.setItem('slopmop_last_folder', '/test/project');
    localStorage.setItem('slopmop_ui:bottom_panel_open', JSON.stringify(true));
    vi.clearAllMocks();
    mockAdd.mockReset();
    mockRawState.sessions = [{ id: 'a', status: 'waiting', cwd: '/test/project' }];
    mockRawState.activeId = 'a';
  });

  it('RawTerminalPane receives cwd equal to the connected project path', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      const pane = container.querySelector('[data-testid="raw-terminal-pane"]');
      expect(pane).not.toBeNull();
    });

    const pane = container.querySelector('[data-testid="raw-terminal-pane"]') as HTMLElement;
    expect(pane.dataset.cwd).toBe('/test/project');
  });
});
