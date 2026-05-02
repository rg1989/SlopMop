import { useState, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';

interface SuperToolsModalProps {
  cwd: string | null;
  onClose: () => void;
  onRunDirect: (command: string) => void;
  onRunWithGsd: (tool: SuperTool) => Promise<void>;
}

interface ToolStep {
  label: string;
  detail: string;
}

interface ToolMeta {
  source: string;
  skillId: string;
}

export interface SuperTool {
  id: string;
  name: string;
  phaseName: string;
  phaseDescription: string;
  description: string;
  directCommand: string;
  steps: ToolStep[];
  meta: ToolMeta;
  Icon: FC;
}

/* ── Tooltip components ── */

const InfoTip: FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }

  return (
    <span className="setting-info" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      <span className="info-icon" ref={ref}>i</span>
      {pos && createPortal(
        <span className="info-tooltip-portal st-tooltip-wide" style={{ top: pos.top, left: pos.left }}>
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
};

const StepTip: FC<{ label: string; detail: string }> = ({ label, detail }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 7, left: r.left + r.width / 2 });
  }

  return (
    <span
      className="st-step"
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {label}
      {pos && createPortal(
        <span className="info-tooltip-portal" style={{ top: pos.top, left: pos.left }}>
          {detail}
        </span>,
        document.body,
      )}
    </span>
  );
};

/* ── Icons ── */

const IconArch: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

const IconTdd: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

const IconSecurity: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconFeature: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconLiveCanvas: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <path d="M3 15h6l3-3 4 4 5-5v6H3z"/>
  </svg>
);

/* ── Tool definitions ── */

export const SUPER_TOOLS: SuperTool[] = [
  {
    id: 'improve-arch',
    name: 'Improve Codebase Architecture',
    phaseName: 'Improve Codebase Architecture',
    phaseDescription:
      'Multi-step automated architectural analysis: surfaces structural coupling hotspots, identifies over/under-abstracted module boundaries, removes dead or redundant code paths, and applies concrete refactors with full test coverage. Commits all changes atomically with a structured improvement report.',
    description:
      'Automated architectural deep-dive. Maps coupling hotspots, removes dead paths, and applies concrete refactors — all backed by tests and committed atomically.',
    directCommand: '/improve-codebase-architecture',
    Icon: IconArch,
    steps: [
      { label: 'Map',     detail: 'Build a structural map of modules, imports, and dependency boundaries.' },
      { label: 'Analyze', detail: 'Identify coupling hotspots, over/under-abstracted boundaries, and dead code.' },
      { label: 'Refactor',detail: 'Apply targeted structural improvements and remove redundant paths.' },
      { label: 'Verify',  detail: 'Run tests and type-checks to confirm nothing broke.' },
      { label: 'Commit',  detail: 'Atomic commit with a structured improvement report.' },
    ],
    meta: {
      source: 'Claude Code skill',
      skillId: 'improve-codebase-architecture',
    },
  },
  {
    id: 'tdd',
    name: 'Test-Driven Development',
    phaseName: 'Test-Driven Development Cycle',
    phaseDescription:
      'Disciplined TDD loop: breaks the feature into testable units, writes failing tests first (Red), implements minimal code to make them pass (Green), then refactors for clarity and maintainability without breaking coverage.',
    description:
      'Strict red-green-refactor loop. Writes failing tests first, then the minimal implementation to pass, then cleans up — no shortcuts.',
    directCommand: '/tdd',
    Icon: IconTdd,
    steps: [
      { label: 'Plan',    detail: 'Break the feature into discrete, independently testable units.' },
      { label: 'Red',     detail: 'Write failing tests that precisely define the expected behavior.' },
      { label: 'Green',   detail: 'Write the minimal implementation needed to make all tests pass.' },
      { label: 'Refactor',detail: 'Clean up code and improve design without breaking any tests.' },
    ],
    meta: {
      source: 'Claude Code skill',
      skillId: 'tdd',
    },
  },
  {
    id: 'security-review',
    name: 'Security Review',
    phaseName: 'Security Review',
    phaseDescription:
      'Full security audit of current branch changes: scans for OWASP top-10 vulnerabilities, assesses attack surface and severity, produces a structured findings report, and applies targeted patches for confirmed issues.',
    description:
      'Deep security audit of your pending changes — OWASP top-10 scan, severity triage, structured report, and targeted patches applied.',
    directCommand: '/security-review',
    Icon: IconSecurity,
    steps: [
      { label: 'Scan',    detail: 'Audit diffs and code for OWASP top-10 and common vulnerability patterns.' },
      { label: 'Triage',  detail: 'Assess severity, exploitability, and attack surface for each finding.' },
      { label: 'Report',  detail: 'Produce a structured findings report with risk ratings.' },
      { label: 'Patch',   detail: 'Apply targeted, minimal fixes for confirmed vulnerabilities.' },
    ],
    meta: {
      source: 'Claude Code skill',
      skillId: 'security-review',
    },
  },
  {
    id: 'full-feature',
    name: 'Full Feature Implementation',
    phaseName: 'Full Feature Implementation',
    phaseDescription:
      'End-to-end feature delivery: defines the spec and API contract, implements backend logic and endpoints, builds frontend components and state, writes unit and integration tests, then wires all layers together.',
    description:
      'End-to-end feature delivery in one pass — spec, backend, frontend, tests, and full integration, all coordinated.',
    directCommand: '/full-feature',
    Icon: IconFeature,
    steps: [
      { label: 'Spec',     detail: 'Define requirements, API contracts, and component boundaries.' },
      { label: 'Backend',  detail: 'Implement server-side logic, endpoints, and data layer.' },
      { label: 'Frontend', detail: 'Build UI components, client state, and user interactions.' },
      { label: 'Test',     detail: 'Write unit, integration, and E2E tests for the full stack.' },
      { label: 'Integrate',detail: 'Wire all layers together and verify the complete flow end-to-end.' },
    ],
    meta: {
      source: 'Claude Code skill',
      skillId: 'full-feature',
    },
  },
  {
    id: 'live-canvas',
    name: 'Live Canvas (HTML dashboard)',
    phaseName: 'Live Canvas',
    phaseDescription:
      'Produces a self-contained HTML5 page at .slop/live-canvas.html: tables, layout, and optional client-side charts for the current task. The user views it in the Live Canvas sidebar tab; the UI polls the file about every 2s so saves show up shortly after.',
    description:
      'Agent writes a full HTML5 dashboard to .slop/live-canvas.html so you can read dense results in a real page instead of chat. Open the Live Canvas tab after it saves.',
    directCommand:
      'Create or update .slop/live-canvas.html with a complete, valid HTML5 document: a visual summary of our current work (use layout, tables, CSS, and optional inline or CDN chart JS as needed). After saving, tell me to open the Live Canvas tab in the SlopMop sidebar to view it.',
    Icon: IconLiveCanvas,
    steps: [
      { label: 'Scope', detail: 'Decide what figures, tables, or flows belong on the page — not a wall of chat text.' },
      { label: 'Build', detail: 'Write one self-contained HTML file with <style> and <script> as needed.' },
      { label: 'Save', detail: 'Persist to .slop/live-canvas.html under the project root (create .slop if missing).' },
      { label: 'View', detail: 'Direct the user to the Live Canvas sidebar tab; it polls ~every 2s so the iframe picks up file changes.' },
    ],
    meta: {
      source: 'SlopMop workspace',
      skillId: 'live-canvas',
    },
  },
];

/* ── Meta provenance row ── */

const ToolMetaRow: FC<{ meta: ToolMeta; command: string }> = ({ meta, command }) => {
  const [copied, setCopied] = useState(false);

  function copyCommand() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <div className="st-meta-row">
      <span className="st-meta-source">{meta.source}</span>
      <span className="st-meta-sep">·</span>
      <button className="st-meta-cmd" onClick={copyCommand} title="Click to copy command">
        {command}
        <span className="st-meta-copy-hint">{copied ? '✓' : 'copy'}</span>
      </button>
    </div>
  );
};

/* ── Modal ── */

export function SuperToolsModal({ cwd, onClose, onRunDirect, onRunWithGsd }: SuperToolsModalProps) {
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleGsd = async (tool: SuperTool) => {
    setRunningId(tool.id);
    try {
      await onRunWithGsd(tool);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel st-modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <div className="st-modal-title-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="modal-title">Super Tools</span>
            <InfoTip text="Heavy multi-step workflow tools. Direct runs the skill immediately. Via GSD creates a tracked phase in your roadmap, runs the same skill, then marks the phase complete automatically when Claude finishes." />
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {SUPER_TOOLS.map((tool) => {
            const isRunning = runningId === tool.id;
            return (
              <div key={tool.id} className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon"><tool.Icon /></div>
                  <span className="st-card-name">{tool.name}</span>
                  <InfoTip text={tool.description} />
                </div>

                <div className="st-steps">
                  {tool.steps.map((step, i) => (
                    <span key={step.label} className="st-step-group">
                      <StepTip label={step.label} detail={step.detail} />
                      {i < tool.steps.length - 1 && <span className="st-step-arrow">›</span>}
                    </span>
                  ))}
                </div>

                <ToolMetaRow meta={tool.meta} command={tool.directCommand} />

                <div className="st-card-actions">
                  <button
                    className="st-btn"
                    disabled={isRunning}
                    onClick={() => { onRunDirect(tool.directCommand); }}
                    title="Send command directly — faster, no roadmap record"
                  >
                    Run Direct
                  </button>
                  <button
                    className="st-btn st-btn--gsd"
                    disabled={isRunning || !cwd}
                    onClick={() => handleGsd(tool)}
                    title={cwd ? 'Create a GSD phase, run the skill, auto-mark complete when done' : 'Open a folder first'}
                  >
                    {isRunning ? 'Starting…' : '⚡ Run via GSD'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
