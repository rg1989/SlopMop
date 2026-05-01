import { useState, useCallback } from 'react';

export interface PttCombo {
  code: string;    // event.code, e.g. 'Space', 'KeyM'
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

// Configures which agent process is spawned in the terminal.
// command: the executable on PATH (e.g. 'claude', 'aider', 'hermes')
// args: additional CLI arguments passed on every launch
// label: display name shown in the UI
export interface AgentConfig {
  command: string;
  args: string[];
  label: string;
}

export const DEFAULT_AGENT: AgentConfig = {
  command: 'claude',
  args: [],
  label: 'Claude',
};

export interface AppSettings {
  recordingMode: 'toggle' | 'hold';
  pttKey: PttCombo | null;
  sidebarTabsOrientation: 'horizontal' | 'vertical';
  showHiddenFiles: boolean;
  agent: AgentConfig;
}

const DEFAULTS: AppSettings = {
  recordingMode: 'toggle',
  pttKey: null,
  sidebarTabsOrientation: 'horizontal',
  showHiddenFiles: true,
  agent: DEFAULT_AGENT,
};

const STORAGE_KEY = 'slopdock_settings';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    // Migrate old string format (pttKey was a bare event.code string)
    if (typeof parsed.pttKey === 'string') {
      parsed.pttKey = parsed.pttKey
        ? { code: parsed.pttKey, ctrl: false, alt: false, shift: false, meta: false }
        : null;
    }
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function save(s: AppSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { settings, update };
}

function keyCodeToLabel(code: string): string {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'Backquote') return '`';
  if (code === 'Minus') return '-';
  if (code === 'Equal') return '=';
  if (code === 'BracketLeft') return '[';
  if (code === 'BracketRight') return ']';
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  if (code === 'Comma') return ',';
  if (code === 'Period') return '.';
  if (code === 'Slash') return '/';
  if (code === 'Backslash') return '\\';
  return code;
}

export function pttComboToLabel(combo: PttCombo | null): string {
  if (!combo) return '';
  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.alt) parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta) parts.push('⌘');
  parts.push(keyCodeToLabel(combo.code));
  return parts.join('+');
}

export function matchesPttCombo(e: KeyboardEvent, combo: PttCombo): boolean {
  return (
    e.code === combo.code &&
    e.ctrlKey === combo.ctrl &&
    e.altKey === combo.alt &&
    e.shiftKey === combo.shift &&
    e.metaKey === combo.meta
  );
}
