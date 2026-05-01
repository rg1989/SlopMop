import { useState } from 'react';

interface OnboardingModalProps {
  initialPath: string | null;
  onDismiss: () => void;
}

export function OnboardingModal({ initialPath, onDismiss }: OnboardingModalProps) {
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
