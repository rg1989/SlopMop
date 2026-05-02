import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import { createPortal } from 'react-dom';
import type { AppSettings, PttCombo, AgentConfig, TypeIndicatorSize } from '../hooks/useSettings';
import { pttComboToLabel, DEFAULT_AGENT } from '../hooks/useSettings';
import { VaultTab } from './VaultTab';
import { TelegramSettingsTab } from './TelegramSettingsTab';

const ShieldIcon: FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
  cwd?: string | null;
}

const InfoTip: FC<{ tip: string }> = ({ tip }) => {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setTooltipPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }

  return (
    <span className="setting-info" onMouseEnter={show} onMouseLeave={() => setTooltipPos(null)}>
      <span className="info-icon" ref={iconRef}>i</span>
      {tooltipPos && createPortal(
        <span className="info-tooltip-portal" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
          {tip}
        </span>,
        document.body,
      )}
    </span>
  );
};

const EyeIcon: FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon: FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

interface KnownAgent { cmd: string; path: string; }

const AgentCommandInput: FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}> = ({ value, onChange, onBlur }) => {
  const [knownAgents, setKnownAgents] = useState<KnownAgent[]>([]);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/known-agents')
      .then(r => r.json())
      .then((data: KnownAgent[]) => setKnownAgents(data))
      .catch(() => {});
  }, []);

  const filtered = knownAgents.filter(a =>
    a.cmd !== value && a.cmd.includes(value.toLowerCase())
  );

  const openDropdown = useCallback(() => {
    if (!inputRef.current) return;
    setDropRect(inputRef.current.getBoundingClientRect());
    setActiveIdx(-1);
  }, []);

  const closeDropdown = useCallback(() => setDropRect(null), []);

  const validate = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) { setNotFound(false); return; }
    setChecking(true);
    try {
      const r = await fetch(`/api/which?cmd=${encodeURIComponent(trimmed)}`);
      const data = await r.json();
      setNotFound(!data.found);
    } catch {
      setNotFound(false);
    } finally {
      setChecking(false);
    }
  }, []);

  function select(cmd: string) {
    onChange(cmd);
    closeDropdown();
    setNotFound(false);
  }

  function handleBlur(e: React.FocusEvent) {
    if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
    closeDropdown();
    validate(value);
    onBlur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropRect) openDropdown();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) {
      e.preventDefault();
      select(filtered[activeIdx].cmd);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  const isOpen = dropRect !== null && filtered.length > 0;

  return (
    <div className="cmd-combobox" ref={wrapRef}>
      <div className="cmd-input-wrap">
        <input
          ref={inputRef}
          className={`settings-text-input${notFound ? ' settings-text-input--error' : ''}`}
          type="text"
          value={value}
          placeholder={DEFAULT_AGENT.command}
          autoComplete="off"
          spellCheck={false}
          onChange={e => { onChange(e.target.value); openDropdown(); setNotFound(false); setActiveIdx(-1); }}
          onFocus={openDropdown}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {checking && <span className="cmd-checking">checking…</span>}
      </div>

      {isOpen && createPortal(
        <ul
          className="cmd-dropdown"
          style={{ top: dropRect!.bottom + 4, left: dropRect!.left, width: dropRect!.width }}
          onMouseDown={e => e.preventDefault()}
        >
          {filtered.map((a, i) => (
            <li
              key={a.cmd}
              className={`cmd-option${i === activeIdx ? ' cmd-option--active' : ''}`}
              onClick={() => select(a.cmd)}
            >
              <span className="cmd-option-name">{a.cmd}</span>
              <span className="cmd-option-path">{a.path}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}

      {notFound && (
        <div className="cmd-error">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
          </svg>
          command not found in PATH
        </div>
      )}
    </div>
  );
};

type SettingsTab = 'display' | 'audio' | 'agent' | 'vault' | 'ai' | 'telegram';

export const SettingsModal: FC<SettingsModalProps> = ({ settings, onUpdate, onClose, cwd }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('display');
  const [guardianEnabled, setGuardianEnabled] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [liveCombo, setLiveCombo] = useState<PttCombo | null>(null);
  const [agentDraft, setAgentDraft] = useState<{ command: string; args: string; label: string }>({
    command: settings.agent.command,
    args: settings.agent.args.join(' '),
    label: settings.agent.label,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  function commitAgent(draft: { command: string; args: string; label: string }) {
    const next: AgentConfig = {
      command: draft.command.trim() || DEFAULT_AGENT.command,
      args: draft.args.trim() ? draft.args.trim().split(/\s+/) : [],
      label: draft.label.trim() || DEFAULT_AGENT.label,
    };
    onUpdate({ agent: next });
  }

  useEffect(() => {
    if (!capturing) { setLiveCombo(null); return; }

    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') { setCapturing(false); return; }

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        setLiveCombo({
          code: '',
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        });
        return;
      }

      const combo: PttCombo = {
        code: e.code,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      };
      onUpdate({ pttKey: combo });
      setCapturing(false);
    };

    const onUp = (e: KeyboardEvent) => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        setLiveCombo(prev => {
          if (!prev) return null;
          return { ...prev, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
        });
      }
    };

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [capturing, onUpdate]);

  useEffect(() => {
    if (capturing) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturing, onClose]);

  useEffect(() => {
    if (!cwd) return;
    fetch(`/api/slop-guardian?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(d => setGuardianEnabled(d.enabled ?? true))
      .catch(() => setGuardianEnabled(true));
  }, [cwd]);

  function setGuardian(enabled: boolean) {
    if (!cwd) return;
    setGuardianEnabled(enabled);
    fetch('/api/slop-guardian', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd, enabled }),
    }).catch(() => {});
  }

  const label = pttComboToLabel(settings.pttKey);

  function captureBtnLabel(): string {
    if (!capturing) return label || 'Not set';
    if (liveCombo) {
      const parts: string[] = [];
      if (liveCombo.ctrl) parts.push('Ctrl');
      if (liveCombo.alt) parts.push('Alt');
      if (liveCombo.shift) parts.push('Shift');
      if (liveCombo.meta) parts.push('⌘');
      if (parts.length) return parts.join('+') + '+…';
    }
    return 'Press a key…';
  }

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-panel modal-panel--settings-wide" role="dialog" aria-modal="true" aria-label="Settings">

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="settings-tab-bar">
          {(['display', 'audio', 'agent', 'vault', 'ai', 'telegram'] as SettingsTab[]).map(tab => (
            <button
              key={tab}
              className={`settings-tab${activeTab === tab ? ' settings-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'display' ? 'Display' : tab === 'audio' ? 'Audio' : tab === 'agent' ? 'Agent & Tools' : tab === 'vault' ? 'Vault' : tab === 'ai' ? 'AI Guardian' : 'Telegram'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Display tab */}
          {activeTab === 'display' && (
            <div className="settings-group">
              <div className="settings-section settings-section--row">
                <div className="settings-section-label">
                  Hidden Files
                  <InfoTip tip="Show or hide dotfiles and dotfolders (e.g. .git, .env) in the file tree. Hidden files appear slightly dimmed when shown." />
                </div>
                <div className="pill-toggle">
                  <button
                    className={`pill-opt pill-opt--icon${settings.showHiddenFiles ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ showHiddenFiles: true })}
                  ><EyeIcon /> Show</button>
                  <button
                    className={`pill-opt pill-opt--icon${!settings.showHiddenFiles ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ showHiddenFiles: false })}
                  ><EyeOffIcon /> Hide</button>
                </div>
              </div>

              <div className="settings-section settings-section--row">
                <div className="settings-section-label">
                  Sidebar Tabs
                  <InfoTip tip="Horizontal: tabs appear as a row at the top of the sidebar. Vertical: tabs appear as a compact icon strip on the left edge of the sidebar." />
                </div>
                <div className="pill-toggle">
                  <button
                    className={`pill-opt${settings.sidebarTabsOrientation === 'horizontal' ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ sidebarTabsOrientation: 'horizontal' })}
                  >Horizontal</button>
                  <button
                    className={`pill-opt${settings.sidebarTabsOrientation === 'vertical' ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ sidebarTabsOrientation: 'vertical' })}
                  >Vertical</button>
                </div>
              </div>

              <div className="settings-section settings-section--row">
                <div className="settings-section-label">
                  Type Icons
                  <InfoTip tip="File type badges shown next to each file in the explorer. Choose a size or hide them entirely." />
                </div>
                <div className="pill-toggle pill-toggle--4">
                  {([14, 11, 9, 'none'] as TypeIndicatorSize[]).map(val => (
                    <button
                      key={String(val)}
                      className={`pill-opt${settings.typeIndicatorSize === val ? ' pill-opt--on' : ''}`}
                      onClick={() => onUpdate({ typeIndicatorSize: val })}
                    >{val === 'none' ? 'None' : val}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audio tab */}
          {activeTab === 'audio' && (
            <div className="settings-group">
              <div className="settings-section settings-section--row">
                <div className="settings-section-label">
                  Recording Mode
                  <InfoTip tip="Toggle: click once to start recording, click again to stop. Hold: press and hold the button or shortcut while speaking, release to send." />
                </div>
                <div className="pill-toggle">
                  <button
                    className={`pill-opt${settings.recordingMode === 'toggle' ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ recordingMode: 'toggle' })}
                  >Toggle</button>
                  <button
                    className={`pill-opt${settings.recordingMode === 'hold' ? ' pill-opt--on' : ''}`}
                    onClick={() => onUpdate({ recordingMode: 'hold' })}
                  >Hold</button>
                </div>
              </div>

              <div className="settings-section settings-section--row">
                <div className="settings-section-label">
                  Push-to-Talk
                  <InfoTip tip="Keyboard shortcut to trigger recording. Click the key display to set a new combo. Modifier keys (Ctrl, Alt, Shift, ⌘) are supported. Press Esc during capture to cancel." />
                </div>
                <div className="settings-ptt-row">
                  <button
                    className={`settings-ptt-capture${capturing ? ' capturing' : ''}`}
                    onClick={() => setCapturing(true)}
                  >
                    {captureBtnLabel()}
                  </button>
                  {settings.pttKey && !capturing && (
                    <button
                      className="settings-ptt-clear"
                      onClick={() => onUpdate({ pttKey: null })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {capturing && (
                <div className="settings-capture-hint">Hold modifiers + press a key — Esc to cancel</div>
              )}
            </div>
          )}

          {/* Vault tab */}
          {activeTab === 'vault' && <VaultTab />}

          {/* Telegram tab */}
          {activeTab === 'telegram' && <TelegramSettingsTab />}

          {/* AI Guardian tab */}
          {activeTab === 'ai' && (
            <div className="settings-group">
              <div className="settings-section settings-section--row">
                <div className="settings-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldIcon />
                  AI Guardian
                  <InfoTip tip="When on, Claude watches for roadmap drift, skipped phases, untracked commits, and recurring issues — and prompts you before things get out of sync. Per-project. Off = work freely without alignment checks." />
                </div>
                <div className="pill-toggle">
                  <button
                    className={`pill-opt${guardianEnabled === true ? ' pill-opt--on' : ''}`}
                    onClick={() => setGuardian(true)}
                    disabled={!cwd}
                  >On</button>
                  <button
                    className={`pill-opt${guardianEnabled === false ? ' pill-opt--on' : ''}`}
                    onClick={() => setGuardian(false)}
                    disabled={!cwd}
                  >Off</button>
                </div>
              </div>

              {!cwd && (
                <div className="settings-section-desc">
                  Open a project folder to configure AI Guardian.
                </div>
              )}

              <div className="settings-info-card" style={{ marginTop: 8 }}>
                <div className="settings-section-label" style={{ marginBottom: 6 }}>What AI Guardian does</div>
                <div className="settings-section-desc" style={{ marginBottom: 0, lineHeight: 1.7 }}>
                  <span style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ color: 'var(--accent)' }}>Roadmap alignment</span> — flags work that isn't in the current phase plan and offers to add it before proceeding.
                  </span>
                  <span style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ color: 'var(--accent)' }}>Phase discipline</span> — warns when jumping ahead of an open phase and asks for intent.
                  </span>
                  <span style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ color: 'var(--accent)' }}>Commit traceability</span> — catches commits not mapped to a task, offers to retro-add them to the roadmap.
                  </span>
                  <span style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ color: 'var(--accent)' }}>Second brain loop</span> — surfaces known pitfalls before you hit them, and proposes knowledge entries when you resolve something novel.
                  </span>
                  <span style={{ display: 'block' }}>
                    Stored in <span style={{ color: 'var(--txt-bright)', fontFamily: 'monospace' }}>.slop/config.json</span> — per project, not global.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Agent & Tools tab */}
          {activeTab === 'agent' && (<>
            <div className="settings-group">
              <div className="settings-section">
                <div className="settings-section-label">
                  Command
                  <InfoTip tip="Executable on your $PATH that will be spawned in the terminal. Installed agent CLIs appear as suggestions." />
                </div>
                <AgentCommandInput
                  value={agentDraft.command}
                  onChange={cmd => setAgentDraft(d => ({ ...d, command: cmd }))}
                  onBlur={() => commitAgent(agentDraft)}
                />
              </div>

              <div className="settings-section">
                <div className="settings-section-label">
                  Args
                  <InfoTip tip="Extra CLI flags passed on every launch, space-separated. Example: --model opus --no-auto-accept" />
                </div>
                <input
                  className="settings-text-input"
                  type="text"
                  value={agentDraft.args}
                  placeholder="e.g. --model opus"
                  onChange={e => setAgentDraft(d => ({ ...d, args: e.target.value }))}
                  onBlur={() => commitAgent(agentDraft)}
                />
              </div>

              <div className="settings-section">
                <div className="settings-section-label">
                  Label
                  <InfoTip tip="Display name shown in the UI header." />
                </div>
                <input
                  className="settings-text-input"
                  type="text"
                  value={agentDraft.label}
                  placeholder={DEFAULT_AGENT.label}
                  onChange={e => setAgentDraft(d => ({ ...d, label: e.target.value }))}
                  onBlur={() => commitAgent(agentDraft)}
                />
              </div>

              <div className="settings-section-desc" style={{ marginBottom: 0 }}>
                Changes take effect on the next session start. Current session keeps its agent.
              </div>
            </div>

            <div className="settings-info-card">
              <div className="settings-section-label" style={{ marginBottom: 6 }}>GSD Roadmap</div>
              <div className="settings-section-desc" style={{ marginBottom: 0 }}>
                The <span className="gsd-highlight-cmd">GSD Roadmap</span> tab shows a live project map when your folder contains a <span className="gsd-highlight-path">.planning/</span> directory generated by the GSD workflow. To initialize, open the terminal in that folder and run <span className="gsd-highlight-cmd">/gsd:new-project</span> in Claude Code.
              </div>
            </div>
          </>)}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="fp-btn primary" onClick={onClose}>Done</button>
        </div>

      </div>
    </div>
  );
};
