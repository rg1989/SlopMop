import { useState } from 'react';

interface LegacyProps {
  initialPath: string | null;
  onDismiss: () => void;
  cwd?: never;
  onInit?: never;
}

interface PropDrivenProps {
  cwd: string;
  onInit: () => void;
  initialPath?: never;
  onDismiss?: never;
}

type OnboardingModalProps = LegacyProps | PropDrivenProps;

export function OnboardingModal(props: OnboardingModalProps) {
  if ('cwd' in props && props.cwd !== undefined) {
    return <PropDrivenModal cwd={props.cwd} onInit={props.onInit!} />;
  }
  return <LegacyModal initialPath={(props as LegacyProps).initialPath} onDismiss={(props as LegacyProps).onDismiss} />;
}

function LegacyModal({ initialPath, onDismiss }: { initialPath: string | null; onDismiss: () => void }) {
  const [visible] = useState(
    () => initialPath === null && !localStorage.getItem('slopdock_onboarded')
  );

  if (!visible) return null;

  function handleDismiss() {
    localStorage.setItem('slopdock_onboarded', '1');
    onDismiss();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Welcome to SlopDock</span>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--txt-sub)', marginTop: 0 }}>
            A terminal workspace for Claude CLI. Three things to know:
          </p>
          <ul style={{ paddingLeft: 20, margin: '12px 0', color: 'var(--txt)' }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Pick a project folder</strong> — click the folder bar above to open a directory. Claude CLI launches in that directory.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Sidebar tabs</strong> — Explorer, Changes, Roadmap, and Brain give you context without leaving the terminal.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Voice + TTS</strong> — use the voice bar at the bottom to speak messages and hear responses read aloud.
            </li>
          </ul>
        </div>
        <div className="modal-footer">
          <button className="fp-btn primary" onClick={handleDismiss}>Get Started</button>
        </div>
      </div>
    </div>
  );
}

function PropDrivenModal({ cwd, onInit }: { cwd: string; onInit: () => void }) {
  async function handleGetStarted() {
    await fetch('/api/slop-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    onInit();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Welcome to SlopDock</span>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--txt-sub)', marginTop: 0 }}>
            A terminal workspace for Claude CLI. Three things to know:
          </p>
          <ul style={{ paddingLeft: 20, margin: '12px 0', color: 'var(--txt)' }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Pick a project folder</strong> — click the folder bar above to open a directory. Claude CLI launches in that directory.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Sidebar tabs</strong> — Explorer, Changes, Roadmap, and Brain give you context without leaving the terminal.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Voice + TTS</strong> — use the voice bar at the bottom to speak messages and hear responses read aloud.
            </li>
          </ul>
        </div>
        <div className="modal-footer">
          <button className="fp-btn primary" onClick={handleGetStarted}>Get Started</button>
        </div>
      </div>
    </div>
  );
}
